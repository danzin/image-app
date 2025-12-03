import "reflect-metadata";
import { container } from "tsyringe";
import mongoose from "mongoose";
import { RedisService } from "../../services/redis.service";
import { PostRepository } from "../../repositories/post.repository";
import { UserRepository } from "../../repositories/user.repository";

interface ProfileSnapshotMessage {
	type: "avatar_changed" | "username_changed";
	userPublicId: string;
	avatarUrl?: string;
	username?: string;
	timestamp: string;
}

/**
 * Background worker that subscribes to profile_snapshot_updates channel
 * and updates embedded author snapshots in posts when users change their avatar or username
 *
 * This decouples the expensive bulk update from the main request/response cycle
 * Uses Redis Pub/Sub for simplicity (fire-and-forget, no persistence)
 */
export class ProfileSyncWorker {
	private redisService!: RedisService;
	private postRepo!: PostRepository;
	private userRepo!: UserRepository;
	private running = false;

	// debounce multiple rapid changes from same user
	private pendingUpdates = new Map<string, { avatarUrl?: string; username?: string; lastSeen: number }>();
	private flushTimer?: NodeJS.Timeout;
	private FLUSH_INTERVAL_MS = 2000; // batch updates every 2 seconds

	constructor() {}

	async init(): Promise<void> {
		this.redisService = container.resolve(RedisService);
		this.postRepo = container.resolve(PostRepository);
		this.userRepo = container.resolve(UserRepository);

		console.info("[profile-sync] dependencies resolved");
	}

	async start(): Promise<void> {
		if (this.running) return;
		this.running = true;

		// subscribe to profile_snapshot_updates channel
		await this.redisService.subscribe<ProfileSnapshotMessage>(["profile_snapshot_updates"], (channel, message) => {
			this.handleMessage(message).catch((err) => {
				console.error("[profile-sync] error handling message", err);
			});
		});

		// start flush timer
		this.flushTimer = setInterval(() => {
			this.flushPendingUpdates().catch((err) => {
				console.error("[profile-sync] flush error", err);
			});
		}, this.FLUSH_INTERVAL_MS);

		console.info("[profile-sync] worker started, listening on profile_snapshot_updates channel");
	}

	async stop(): Promise<void> {
		this.running = false;
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
		}
		// flush any remaining updates
		await this.flushPendingUpdates();
		console.info("[profile-sync] worker stopped");
	}

	private async handleMessage(message: ProfileSnapshotMessage): Promise<void> {
		const { type, userPublicId, avatarUrl, username } = message;

		console.log(`[profile-sync] received ${type} for user ${userPublicId}`);

		// coalesce updates for same user
		const existing = this.pendingUpdates.get(userPublicId) ?? { lastSeen: Date.now() };

		if (type === "avatar_changed" && avatarUrl !== undefined) {
			existing.avatarUrl = avatarUrl;
		}
		if (type === "username_changed" && username !== undefined) {
			existing.username = username;
		}
		existing.lastSeen = Date.now();

		this.pendingUpdates.set(userPublicId, existing);
	}

	private async flushPendingUpdates(): Promise<void> {
		if (this.pendingUpdates.size === 0) return;

		const entries = Array.from(this.pendingUpdates.entries());
		this.pendingUpdates.clear();

		console.log(`[profile-sync] flushing ${entries.length} pending profile updates`);

		for (const [userPublicId, updates] of entries) {
			try {
				// find user's ObjectId from publicId
				const user = await this.userRepo.findByPublicId(userPublicId);
				if (!user) {
					console.warn(`[profile-sync] user not found: ${userPublicId}`);
					continue;
				}

				const userObjectId = new mongoose.Types.ObjectId(user.id);

				const snapshotUpdates: {
					username?: string;
					avatarUrl?: string;
				} = {};

				if (updates.avatarUrl !== undefined) {
					snapshotUpdates.avatarUrl = updates.avatarUrl;
				}
				if (updates.username !== undefined) {
					snapshotUpdates.username = updates.username;
				}

				if (Object.keys(snapshotUpdates).length === 0) {
					continue;
				}

				const modifiedCount = await this.postRepo.updateAuthorSnapshot(userObjectId, snapshotUpdates);

				console.log(
					`[profile-sync] updated ${modifiedCount} posts for user ${userPublicId}:`,
					JSON.stringify(snapshotUpdates)
				);
			} catch (error) {
				console.error(`[profile-sync] failed to update posts for user ${userPublicId}:`, error);
			}
		}
	}
}
