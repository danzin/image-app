import { validate as uuidValidate, version as uuidVersion } from "uuid";
import mongoose from "mongoose";
import sanitizeHtml from "sanitize-html";

/**
 * Sanitizes objects for Mongo by removing dangerous keys that could enable NoSQL injection
 * Also strips prototype pollution keys and removes keys with empty object values
 */
export function sanitizeForMongo(input: any): any {
	if (input === null || input === undefined) return input;
	if (Array.isArray(input)) return input.map(sanitizeForMongo);

	// preserve Mongo objIDs
	if (input instanceof mongoose.Types.ObjectId) return input;

	if (typeof input !== "object") return input; // strings/numbers/booleans are safe

	const out: any = {};
	const dangerousKeys = ["__proto__", "constructor", "prototype"];

	for (const key of Object.keys(input)) {
		// drop NoSQL injection operators and path traversal
		if (key.startsWith("$") || key.includes(".")) {
			continue;
		}
		// drop prototype pollution keys
		if (dangerousKeys.includes(key)) {
			continue;
		}

		const sanitizedValue = sanitizeForMongo(input[key]);

		// skip keys with empty object values (result of sanitizing nested malicious objects)
		if (
			typeof sanitizedValue === "object" &&
			sanitizedValue !== null &&
			!(sanitizedValue instanceof mongoose.Types.ObjectId) &&
			!Array.isArray(sanitizedValue) &&
			Object.keys(sanitizedValue).length === 0
		) {
			continue;
		}

		out[key] = sanitizedValue;
	}
	return out;
}

/**
 * Validates UUID v4 format for publicIds
 */
export function isValidPublicId(id: unknown): id is string {
	if (typeof id !== "string") return false;
	// validate + check it's specifically version 4
	return uuidValidate(id) && uuidVersion(id) === 4;
}

/**
 * Sanitizes HTML content to prevent XSS attacks
 * Strips all HTML tags and attributes
 */
export const sanitize = (text: string): string =>
	sanitizeHtml(text, {
		allowedTags: [],
		allowedAttributes: {},
	});

/**
 * Validates and sanitizes text input with length constraints
 */
export function sanitizeTextInput(input: unknown, maxLength: number = 5000): string {
	if (typeof input !== "string") {
		throw new Error("Input must be a string");
	}

	const trimmed = input.trim();
	if (trimmed.length === 0) {
		throw new Error("Input cannot be empty");
	}

	if (trimmed.length > maxLength) {
		throw new Error(`Input cannot exceed ${maxLength} characters`);
	}

	const sanitized = sanitize(trimmed);
	if (sanitized.length === 0) {
		throw new Error("Input is empty after sanitization");
	}

	return sanitized;
}
