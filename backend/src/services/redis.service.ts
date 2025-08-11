import { injectable } from "tsyringe";
import { createClient, RedisClientType } from "redis";
import fs from "fs";

@injectable()
export class RedisService {
	private client: RedisClientType;

	constructor() {
		const runningInDocker = fs.existsSync("/.dockerenv");
		const redisUrl = process.env.REDIS_URL || (runningInDocker ? "redis://redis:6379" : "redis://127.0.0.1:6379");

		this.client = createClient({ url: redisUrl });

		this.client.on("connect", () => console.log(`Connected to Redis at ${redisUrl}`));
		this.client.on("error", (err) => console.error("Redis error:", err));

		this.connect();
	}

	private async connect() {
		try {
			await this.client.connect();
		} catch (error) {
			console.error("Redis connection error:", error);
		}
	}

	async get<T = any>(key: string): Promise<T | null> {
		const data = await this.client.get(key);
		return data ? JSON.parse(data) : null;
	}

	async set(key: string, value: any, ttl?: number): Promise<void> {
		const stringValue = JSON.stringify(value);
		if (ttl) {
			await this.client.setEx(key, ttl, stringValue);
		} else {
			await this.client.set(key, stringValue);
		}
	}

	async del(keyPattern: string): Promise<void> {
		const keys = await this.client.keys(keyPattern);
		if (keys.length > 0) {
			await this.client.del(keys);
		}
	}
}
