import { validate as uuidValidate, version as uuidVersion } from "uuid";

export function sanitizeForMongo(input: any): any {
	if (input === null || input === undefined) return input;
	if (Array.isArray(input)) return input.map(sanitizeForMongo);
	if (typeof input !== "object") return input; // strings/numbers/booleans are safe

	const out: any = {};
	for (const key of Object.keys(input)) {
		if (key.startsWith("$") || key.includes(".")) {
			// drop dangerous structural keys
			continue;
		}
		out[key] = sanitizeForMongo(input[key]);
	}
	return out;
}

/**
 * Basic publicId validator using UUID package helpers
 */
export function isValidPublicId(id: unknown): id is string {
	if (typeof id !== "string") return false;
	// validate + check it's specifically version 4
	return uuidValidate(id) && uuidVersion(id) === 4;
}
