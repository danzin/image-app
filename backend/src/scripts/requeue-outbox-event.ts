import "reflect-metadata";
import "@/runtime/bootstrap-env";
import mongoose from "mongoose";
import { OutboxModel } from "@/models/outbox.model";
import { OutboxRepository } from "@/repositories/outbox.repository";
import { serializeError } from "@/utils/error-serialization";

export function parseOutboxEventId(value: string | undefined): string {
  if (
    !value ||
    !mongoose.Types.ObjectId.isValid(value) ||
    new mongoose.Types.ObjectId(value).toHexString() !== value.toLowerCase()
  ) {
    throw new Error(
      "Usage: node backend/dist/scripts/requeue-outbox-event.js <outbox-object-id>",
    );
  }

  return value.toLowerCase();
}

export function requireMongoUri(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const uri = env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is required");
  }

  return uri;
}

export async function main(): Promise<void> {
  const eventId = parseOutboxEventId(process.argv[2]);
  const uri = requireMongoUri();

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  try {
    const repository = new OutboxRepository(OutboxModel);
    const requeued = await repository.requeueExhaustedEvent(eventId);
    if (!requeued) {
      throw new Error("Outbox event was not found or is not exhausted");
    }

    process.stdout.write(
      `${JSON.stringify({
        event: "outbox.event.requeued",
        eventId,
      })}\n`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const serialized = serializeError(error);
    process.stderr.write(
      `${JSON.stringify({
        event: "outbox.event.requeue_failed",
        error: {
          name: serialized.name,
          message: serialized.message,
        },
      })}\n`,
    );
    process.exitCode = 1;
  });
}
