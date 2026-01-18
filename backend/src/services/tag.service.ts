import { inject, injectable } from "tsyringe";
import mongoose, { ClientSession } from "mongoose";
import { TagRepository } from "../repositories/tag.repository";
import { ITag } from "../types/index";

@injectable()
export class TagService {
	constructor(@inject("TagRepository") private readonly tagRepository: TagRepository) {}

	/**
	 * ensures tags exist in the database, creating them if necessary
	 * returns the full tag documents
	 */
	async ensureTagsExist(tagNames: string[], session?: ClientSession): Promise<ITag[]> {
		if (!tagNames.length) {
			return [];
		}

		const unique = Array.from(new Set(tagNames.map((tag) => this.normalize(tag))).values()).filter(
			(tag) => tag
		);

		if (!unique.length) {
			return [];
		}

		// Batch query for all tags at once
		const existingTags = await this.tagRepository.findByTags(unique, session);
		const existingTagMap = new Map(existingTags.map((tag) => [tag.tag, tag]));

		const tagDocs: ITag[] = [];
		for (const tag of unique) {
			const existing = existingTagMap.get(tag);
			if (existing) {
				tagDocs.push(existing);
			} else {
				const created = await this.tagRepository.create(
					{
						tag,
						count: 0,
						modifiedAt: new Date(),
					} as Partial<ITag>,
					session
				);
				tagDocs.push(created);
			}
		}

		return tagDocs;
	}

	/**
	 * resolves tag names to their internal ObjectIds without creating new tags
	 * returns only existing tag IDs
	 */
	async resolveTagIds(tagNames: string[]): Promise<string[]> {
		const unique = Array.from(new Set(tagNames.map((tag) => this.normalize(tag))).values()).filter(
			(tag) => tag
		);

		if (!unique.length) {
			return [];
		}

		// Batch query for all tags at once
		const existingTags = await this.tagRepository.findByTags(unique);
		return existingTags.map((tag) => tag._id.toString());
	}

	/**
	 * increments usage count for multiple tags atomically
	 */
	async incrementUsage(tagIds: mongoose.Types.ObjectId[], session?: ClientSession): Promise<void> {
		if (!tagIds.length) return;

		const now = new Date();
		await Promise.all(
			tagIds.map((tagId) =>
				this.tagRepository.findOneAndUpdate({ _id: tagId }, { $inc: { count: 1 }, $set: { modifiedAt: now } }, session)
			)
		);
	}

	/**
	 * decrements usage count for multiple tags atomically
	 */
	async decrementUsage(tagIds: mongoose.Types.ObjectId[], session?: ClientSession): Promise<void> {
		if (!tagIds.length) return;

		const now = new Date();
		await Promise.all(
			tagIds.map((tagId) =>
				this.tagRepository.findOneAndUpdate({ _id: tagId }, { $inc: { count: -1 }, $set: { modifiedAt: now } }, session)
			)
		);
	}

	/**
	 * extracts hashtags from text and combines with explicit tags
	 */
	collectTagNames(body: string | undefined, explicitTags?: string[]): string[] {
		const hashtags = this.extractHashtags(body);
		const provided = Array.isArray(explicitTags) ? explicitTags : [];
		return [...hashtags, ...provided];
	}

	/**
	 * extracts hashtags from text using regex
	 */
	private extractHashtags(text?: string): string[] {
		if (!text) return [];
		const matches = text.match(/#([\p{L}\p{N}_-]+)/gu) || [];
		return matches.map((tag) => tag.substring(1));
	}

	/**
	 * normalizes tag by removing leading hashes, trimming, and lowercasing
	 */
	private normalize(tag?: string): string {
		if (!tag) return "";
		return tag.replace(/^#+/, "").trim().toLowerCase();
	}
}
