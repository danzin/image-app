import { IImage, Notification } from "../types";

type RawRecord = Record<string, unknown>;

function isObject(val: unknown): val is RawRecord {
	return typeof val === "object" && val !== null;
}

// Map raw image (backend shape) to frontend IImage
export function mapImage(rawInput: unknown): IImage {
	const raw = isObject(rawInput) ? rawInput : {};
	const user = isObject(raw.user) ? raw.user : {};
	const tagsSource = Array.isArray(raw.tags) ? raw.tags : [];
	const tagStrings = tagsSource
		.map((t) => (isObject(t) && typeof t.tag === "string" ? t.tag : typeof t === "string" ? t : null))
		.filter((t): t is string => !!t);

	return {
		publicId: String(raw.publicId || ""),
		slug: String(raw.slug || ""),
		url: String(raw.url || ""),
		title: typeof raw.title === "string" ? raw.title : undefined,
		tags: tagStrings,
		user: {
			publicId: String(user.publicId || ""),
			username: String(user.username || ""),
			avatar: String(user.avatar || ""),
		},
		likes: typeof raw.likes === "number" ? raw.likes : 0,
		commentsCount: typeof raw.commentsCount === "number" ? raw.commentsCount : 0,
		createdAt: new Date(String(raw.createdAt || new Date().toISOString())),
		isLikedByViewer: typeof raw.isLikedByViewer === "boolean" ? raw.isLikedByViewer : false,
	};
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
