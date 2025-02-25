import { injectable } from "tsyringe";
import { createClient, RedisClientType } from "redis";

@injectable()
export class RedisService {
  private client: RedisClientType;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 
        `redis://${process.env.NODE_ENV === "development" ? 'localhost:6379' : 'redis:6379'}`,
    });
    

    this.client.on("connect", () => console.log("Connected to Redis"));
    this.client.on("error", (err) => console.error("Redis error:", err));

    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
    } catch (error) {
      console.error("Redis connection error:", error);
    }
  }

  async get(key: string): Promise<any> {
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
