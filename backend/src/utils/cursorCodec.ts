export const decodeCursor = <T extends Record<string, unknown>>(cursor?: string): T | null => {
	if (!cursor) {
		return null;
	}

	try {
		const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
		if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
			return null;
		}
		return decoded as T;
	} catch {
		return null;
	}
};

export const encodeCursor = (payload: Record<string, unknown>): string =>
	Buffer.from(JSON.stringify(payload)).toString("base64");
