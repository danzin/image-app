import { inject, injectable } from "tsyringe";
import { TOKENS } from "@/types/tokens";
import type {
  ITrendingStreamConsumer,
  ITrendingStreamStore,
  TrendingStreamClient,
  TrendingStreamConfig,
  TrendingStreamMessage,
} from "./trending.ports";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

@injectable()
export class TrendingStreamConsumer implements ITrendingStreamConsumer {
  constructor(
    @inject(TOKENS.Services.TrendingStreamStore)
    private readonly streamStore: ITrendingStreamStore,
  ) {}

  async initialize(
    config: TrendingStreamConfig,
    timeoutMs: number,
  ): Promise<TrendingStreamClient> {
    const connected = await this.streamStore.waitForConnection(timeoutMs);
    if (!connected) {
      throw new Error("Redis unavailable; trending worker cannot start");
    }

    await this.streamStore.ensureConsumerGroup(config.stream, config.group);
    return this.streamStore.createClient();
  }

  async close(client: TrendingStreamClient): Promise<void> {
    await this.streamStore.closeClient(client);
  }

  async read(
    client: TrendingStreamClient,
    config: TrendingStreamConfig,
  ): Promise<TrendingStreamMessage[]> {
    const response = await this.streamStore.readGroup(client, config);
    if (response === null) {
      return [];
    }
    if (!Array.isArray(response)) {
      throw new TypeError("Malformed Redis stream response");
    }

    const messages: TrendingStreamMessage[] = [];
    for (const streamResponse of response) {
      if (
        !isRecord(streamResponse) ||
        !Array.isArray(streamResponse.messages)
      ) {
        throw new TypeError("Malformed Redis stream response");
      }

      for (const message of streamResponse.messages) {
        const id = isRecord(message) ? message.id : undefined;
        const fields = isRecord(message) ? message.message : undefined;
        if (typeof id !== "string" || !isStringRecord(fields)) {
          throw new TypeError("Malformed Redis stream message");
        }
        messages.push({ id, fields });
      }
    }

    return messages;
  }

  async acknowledge(
    config: TrendingStreamConfig,
    ids: readonly string[],
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.streamStore.acknowledge(config.stream, config.group, ids);
  }

  async findReclaimableMessageIds(
    config: TrendingStreamConfig,
    count: number,
  ): Promise<string[]> {
    const response = await this.streamStore.pendingRange(
      config.stream,
      config.group,
      count,
    );
    if (!Array.isArray(response)) {
      throw new TypeError("Malformed XPENDING response");
    }

    const messageIds: string[] = [];
    for (const entry of response) {
      if (
        !isRecord(entry) ||
        typeof entry.id !== "string" ||
        typeof entry.millisecondsSinceLastDelivery !== "number" ||
        !Number.isFinite(entry.millisecondsSinceLastDelivery)
      ) {
        throw new TypeError("Malformed XPENDING entry");
      }
      if (entry.millisecondsSinceLastDelivery >= config.reclaimMinIdleMs) {
        messageIds.push(entry.id);
      }
    }

    return messageIds;
  }

  async claim(
    config: TrendingStreamConfig,
    ids: readonly string[],
  ): Promise<TrendingStreamMessage[]> {
    const response = await this.streamStore.claim(config, ids);
    if (!Array.isArray(response)) {
      throw new TypeError("Malformed XCLAIM response");
    }

    const messages: TrendingStreamMessage[] = [];
    for (const message of response) {
      if (message === null) {
        continue;
      }
      const id = isRecord(message) ? message.id : undefined;
      const fields = isRecord(message) ? message.message : undefined;
      if (typeof id !== "string" || !isStringRecord(fields)) {
        throw new TypeError("Malformed XCLAIM entry");
      }
      messages.push({ id, fields });
    }

    return messages;
  }
}
