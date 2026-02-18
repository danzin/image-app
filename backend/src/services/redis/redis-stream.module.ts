import { RedisClientType } from "redis";

export class RedisStreamModule {
	constructor(private readonly client: RedisClientType) {}

	async pushToStream(stream = "stream:interactions", payload: Record<string, unknown>): Promise<string> {
		const prepared: Record<string, string> = {};
		for (const [k, v] of Object.entries(payload)) {
			prepared[k] = typeof v === "string" ? v : JSON.stringify(v);
		}
		return await this.client.xAdd(stream, "*", prepared);
	}

	async createStreamConsumerGroup(stream = "stream:interactions", group = "trendingGroup"): Promise<void> {
		try {
			await this.client.xGroupCreate(stream, group, "$", { MKSTREAM: true });
		} catch (err) {
			const msg = String((err as Error)?.message ?? err);
			if (!msg.includes("BUSYGROUP")) {
				throw err;
			}
		}
	}

	async ackStreamMessages(stream: string, group: string, ...ids: string[]): Promise<number> {
		const res = await this.client.xAck(stream, group, ids);
		return res as number;
	}

	async xPendingRange(stream: string, group: string, start = "-", end = "+", count = 1000): Promise<unknown> {
		return await this.client.xPendingRange(stream, group, start, end, count);
	}

	async xClaim(stream: string, group: string, consumer: string, minIdleMs: number, ids: string[]): Promise<unknown> {
		return await this.client.xClaim(stream, group, consumer, minIdleMs, ids);
	}
}
