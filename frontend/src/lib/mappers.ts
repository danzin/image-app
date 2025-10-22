import { IImage, IPost, Notification } from "../types";

type RawRecord = Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Maps raw post data from backend to frontend IPost interface
 * Handles both legacy image format and new post format
 */
export function mapPost(rawInput: unknown): IPost {
	const raw = isObject(rawInput) ? rawInput : {};
	const user = isObject(raw.user) ? raw.user : {};

	// Extract tags (supports both string[] and ITag[])
	const tagsSource = Array.isArray(raw.tags) ? raw.tags : [];
	const tagStrings = tagsSource
		.map((t) => {
			if (typeof t === "string") return t;
			if (isObject(t) && typeof t.tag === "string") return t.tag;
			return null;
		})
		.filter((t): t is string => !!t);

	// Handle image data (may come in different formats)
	let imageUrl: string | undefined;
	let imagePublicId: string | undefined;

	if (isObject(raw.image)) {
		// New format: { image: { url, publicId } }
		imageUrl = String(raw.image.url || "");
		imagePublicId = String(raw.image.publicId || "");
	} else if (raw.url && typeof raw.url === "string") {
		// Legacy format: { url, imagePublicId }
		imageUrl = String(raw.url);
		imagePublicId = raw.imagePublicId ? String(raw.imagePublicId) : undefined;
	}

	// Determine post type
	const hasImage = !!imageUrl;
	const hasBody = !!raw.body && String(raw.body).trim().length > 0;
	let postType: "text" | "image" | "mixed" = "text";

	if (hasImage && hasBody) postType = "mixed";
	else if (hasImage) postType = "image";
	else if (hasBody) postType = "text";

	// Build the post object
	const post: IPost = {
		publicId: String(raw.publicId || ""),
		slug: raw.slug ? String(raw.slug) : undefined,
		body: raw.body ? String(raw.body) : undefined,

		// Image data
		image: imageUrl
			? {
					url: imageUrl,
					publicId: imagePublicId || "",
				}
			: null,

		// Flattened image data (backward compatibility)
		url: imageUrl,
		imagePublicId,

		tags: tagStrings,

		user: {
			publicId: String(user.publicId || ""),
			username: String(user.username || ""),
			avatar: String(user.avatar || ""),
		},

		likes: typeof raw.likes === "number" ? raw.likes : 0,
		commentsCount: typeof raw.commentsCount === "number" ? raw.commentsCount : 0,
		createdAt: new Date(String(raw.createdAt || new Date().toISOString())),
		postType,
		isLikedByViewer: typeof raw.isLikedByViewer === "boolean" ? raw.isLikedByViewer : false,
		isFavoritedByViewer: typeof raw.isFavoritedByViewer === "boolean" ? raw.isFavoritedByViewer : false,
	};

	return post;
}

/**
 * Legacy mapper calling mapPost
 */
export function mapImage(rawInput: unknown): IImage {
	const post = mapPost(rawInput);

	// Ensure url is present for IImage interface
	if (!post.url) {
		console.warn("mapImage called on post without image:", post.publicId);
	}

	return post as IImage;
}

/**
 * Maps an array of raw posts
 */
export function mapPosts(rawArray: unknown[]): IPost[] {
	if (!Array.isArray(rawArray)) return [];
	return rawArray.map(mapPost);
}

// Map raw notification to frontend Notification
export function mapNotification(rawInput: unknown): Notification {
	const raw = isObject(rawInput) ? rawInput : {};
	const ts = raw.timestamp;
	const idVal = (raw as RawRecord).id || (raw as RawRecord)._id;
	return {
		id: String(idVal || ""),
		userId: String(raw.userId || ""),
		actionType: String(raw.actionType || ""),
		actorId: String(raw.actorId || ""),
		actorUsername: typeof raw.actorUsername === "string" ? raw.actorUsername : undefined,
		targetId: typeof raw.targetId === "string" ? raw.targetId : undefined,
		timestamp: typeof ts === "string" ? ts : new Date(String(ts || Date.now())).toISOString(),
		isRead: Boolean(raw.isRead),
	};
}
