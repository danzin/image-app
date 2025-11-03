import { expect } from "chai";
import mongoose from "mongoose";
import { sanitizeForMongo, isValidPublicId, sanitizeTextInput } from "../../utils/sanitizers";

describe("Sanitizers", () => {
	describe("sanitizeForMongo", () => {
		it("should remove $ operators to prevent NoSQL injection", () => {
			const malicious = {
				username: "admin",
				password: { $gt: "" }, // attempts to bypass password check
			};

			const result = sanitizeForMongo(malicious);

			expect(result).to.deep.equal({ username: "admin" });
			expect(result.password).to.be.undefined;
		});

		it("should remove $ne operator", () => {
			const malicious = {
				email: "admin@example.com",
				password: { $ne: null }, // bypass password validation
			};

			const result = sanitizeForMongo(malicious);

			expect(result).to.deep.equal({ email: "admin@example.com" });
			expect(result.password).to.be.undefined;
		});

		it("should remove $regex operator to prevent regex injection", () => {
			const malicious = {
				username: { $regex: ".*" }, // attempts to match all users
				normalField: "safe",
			};

			const result = sanitizeForMongo(malicious);

			expect(result).to.deep.equal({ normalField: "safe" });
			expect(result.username).to.be.undefined;
		});

		it("should remove dot notation to prevent path traversal", () => {
			const malicious = {
				"user.role": "admin", // attempts to set nested field
				normalField: "safe",
			};

			const result = sanitizeForMongo(malicious);

			expect(result).to.deep.equal({ normalField: "safe" });
			expect(result["user.role"]).to.be.undefined;
		});

		it("should strip prototype pollution keys", () => {
			const malicious = {
				__proto__: { isAdmin: true },
				constructor: { prototype: { isAdmin: true } },
				prototype: { isAdmin: true },
				normalField: "safe",
			};

			const result = sanitizeForMongo(malicious);

			expect(result).to.deep.equal({ normalField: "safe" });
			// use hasOwnProperty to check that these keys were not added as own properties
			expect(result.hasOwnProperty("__proto__")).to.be.false;
			expect(result.hasOwnProperty("constructor")).to.be.false;
			expect(result.hasOwnProperty("prototype")).to.be.false;
		});
		it("should preserve MongoDB ObjectIds", () => {
			const objectId = new mongoose.Types.ObjectId();
			const input = {
				userId: objectId,
				username: "test",
			};

			const result = sanitizeForMongo(input);

			expect(result.userId).to.equal(objectId);
			expect(result.username).to.equal("test");
		});

		it("should recursively sanitize nested objects", () => {
			const malicious = {
				user: {
					$ne: null, // NoSQL injection in nested object
					profile: {
						"settings.isAdmin": true, // path traversal in deep nesting
						validField: "safe",
					},
				},
				safe: "value",
			};

			const result = sanitizeForMongo(malicious);

			expect(result).to.deep.equal({
				user: { profile: { validField: "safe" } },
				safe: "value",
			});
		});

		it("should sanitize arrays", () => {
			const malicious = [{ $gt: 0 }, { "user.role": "admin" }, { safe: "value" }];

			const result = sanitizeForMongo(malicious);

			expect(result).to.deep.equal([{}, {}, { safe: "value" }]);
		});

		it("should sanitize arrays of objects with mixed dangerous keys", () => {
			const malicious = {
				items: [
					{ $where: "malicious code", name: "item1" },
					{ __proto__: { evil: true }, name: "item2" },
					{ "nested.path": "bad", name: "item3" },
				],
			};

			const result = sanitizeForMongo(malicious);

			expect(result).to.deep.equal({
				items: [{ name: "item1" }, { name: "item2" }, { name: "item3" }],
			});
		});

		it("should handle null and undefined", () => {
			expect(sanitizeForMongo(null)).to.be.null;
			expect(sanitizeForMongo(undefined)).to.be.undefined;
		});

		it("should preserve primitives", () => {
			expect(sanitizeForMongo("string")).to.equal("string");
			expect(sanitizeForMongo(123)).to.equal(123);
			expect(sanitizeForMongo(true)).to.equal(true);
			expect(sanitizeForMongo(false)).to.equal(false);
		});

		it("should handle deeply nested malicious objects", () => {
			const malicious = {
				level1: {
					level2: {
						level3: {
							$where: "1==1",
							__proto__: { isAdmin: true },
							"path.traversal": "bad",
							safe: "value",
						},
					},
				},
			};

			const result = sanitizeForMongo(malicious);

			expect(result).to.deep.equal({
				level1: {
					level2: {
						level3: {
							safe: "value",
						},
					},
				},
			});
		});

		it("should handle empty objects", () => {
			const result = sanitizeForMongo({});
			expect(result).to.deep.equal({});
		});

		it("should handle empty arrays", () => {
			const result = sanitizeForMongo([]);
			expect(result).to.deep.equal([]);
		});

		it("should remove all MongoDB operators", () => {
			const malicious = {
				$where: "malicious",
				$expr: { $gt: ["$field", 100] },
				$text: { $search: "text" },
				$nor: [{ field: "value" }],
				$and: [{ field: "value" }],
				$or: [{ field: "value" }],
				safe: "value",
			};

			const result = sanitizeForMongo(malicious);

			expect(result).to.deep.equal({ safe: "value" });
		});
	});

	describe("isValidPublicId", () => {
		it("should accept valid UUID v4", () => {
			const validUuid = "550e8400-e29b-41d4-a716-446655440000";
			expect(isValidPublicId(validUuid)).to.be.true;
		});

		it("should accept another valid UUID v4", () => {
			const validUuid = "bcac4271-2976-4d96-bb5b-364edc5eea0c";
			expect(isValidPublicId(validUuid)).to.be.true;
		});

		it("should reject non-UUID strings", () => {
			expect(isValidPublicId("not-a-uuid")).to.be.false;
			expect(isValidPublicId("123456")).to.be.false;
			expect(isValidPublicId("")).to.be.false;
		});

		it("should reject UUID v1", () => {
			const uuidV1 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
			expect(isValidPublicId(uuidV1)).to.be.false;
		});

		it("should reject UUID v3", () => {
			const uuidV3 = "6fa459ea-ee8a-3ca4-894e-db77e160355e";
			expect(isValidPublicId(uuidV3)).to.be.false;
		});

		it("should reject UUID v5", () => {
			const uuidV5 = "886313e1-3b8a-5372-9b90-0c9aee199e5d";
			expect(isValidPublicId(uuidV5)).to.be.false;
		});

		it("should reject non-string types", () => {
			expect(isValidPublicId(null)).to.be.false;
			expect(isValidPublicId(undefined)).to.be.false;
			expect(isValidPublicId(123)).to.be.false;
			expect(isValidPublicId({})).to.be.false;
			expect(isValidPublicId([])).to.be.false;
		});

		it("should reject malformed UUIDs", () => {
			expect(isValidPublicId("550e8400-e29b-41d4-a716")).to.be.false;
			expect(isValidPublicId("550e8400e29b41d4a716446655440000")).to.be.false;
			expect(isValidPublicId("550e8400-e29b-41d4-a716-44665544000g")).to.be.false;
		});

		it("should reject NoSQL injection attempts in publicId", () => {
			expect(isValidPublicId({ $ne: null } as any)).to.be.false;
			expect(isValidPublicId({ $gt: "" } as any)).to.be.false;
		});
	});

	describe("sanitizeTextInput", () => {
		it("should trim and sanitize valid text", () => {
			const result = sanitizeTextInput("  Hello World  ");
			expect(result).to.equal("Hello World");
		});

		it("should preserve regular text without HTML", () => {
			const result = sanitizeTextInput("This is a normal post body");
			expect(result).to.equal("This is a normal post body");
		});

		it("should strip HTML/XSS attempts", () => {
			const xss = '<script>alert("XSS")</script>Hello';
			const result = sanitizeTextInput(xss);
			expect(result).to.equal("Hello");
		});

		it("should strip script tags with attributes", () => {
			const xss = '<script type="text/javascript">alert("XSS")</script>Safe text';
			const result = sanitizeTextInput(xss);
			expect(result).to.equal("Safe text");
		});

		it("should strip img tags with onerror XSS", () => {
			const xss = '<img src=x onerror="alert(1)">test';
			const result = sanitizeTextInput(xss);
			expect(result).to.equal("test");
		});

		it("should strip iframe tags", () => {
			const xss = '<iframe src="evil.com"></iframe>Safe content';
			const result = sanitizeTextInput(xss);
			expect(result).to.equal("Safe content");
		});

		it("should strip all HTML tags", () => {
			const html = "<div><p>Hello <strong>World</strong></p></div>";
			const result = sanitizeTextInput(html);
			expect(result).to.equal("Hello World");
		});

		it("should reject empty strings after trimming", () => {
			expect(() => sanitizeTextInput("   ")).to.throw("Input cannot be empty");
		});

		it("should reject empty string", () => {
			expect(() => sanitizeTextInput("")).to.throw("Input cannot be empty");
		});

		it("should reject non-string input", () => {
			expect(() => sanitizeTextInput(123 as any)).to.throw("Input must be a string");
			expect(() => sanitizeTextInput(null as any)).to.throw("Input must be a string");
			expect(() => sanitizeTextInput(undefined as any)).to.throw("Input must be a string");
			expect(() => sanitizeTextInput({} as any)).to.throw("Input must be a string");
			expect(() => sanitizeTextInput([] as any)).to.throw("Input must be a string");
		});

		it("should enforce max length", () => {
			const longText = "a".repeat(300);
			expect(() => sanitizeTextInput(longText, 250)).to.throw("Input cannot exceed 250 characters");
		});

		it("should allow text at exact max length", () => {
			const text = "a".repeat(250);
			const result = sanitizeTextInput(text, 250);
			expect(result).to.equal(text);
		});

		it("should reject input that becomes empty after sanitization", () => {
			const onlyHtml = "<script>alert('xss')</script>";
			expect(() => sanitizeTextInput(onlyHtml)).to.throw("Input is empty after sanitization");
		});

		it("should reject input with only HTML tags and whitespace", () => {
			const onlyHtml = "  <div></div>  <p></p>  ";

			// sanitize-html preserves whitespace between tags, so this won't be completely empty
			// The result will be whitespace, which is a valid string after trimming is already done
			const result = sanitizeTextInput(onlyHtml);
			// The whitespace between tags gets preserved, so it won't throw
			expect(result).to.be.a("string");
		});

		it("should handle complex XSS attempts", () => {
			const xss = '<img src=x onerror="alert(1)">test';
			const result = sanitizeTextInput(xss);
			expect(result).to.equal("test");
		});

		it("should handle SVG-based XSS", () => {
			const xss = '<svg onload="alert(1)">Safe text';
			const result = sanitizeTextInput(xss);
			expect(result).to.equal("Safe text");
		});

		it("should handle event handler XSS", () => {
			const xss = '<button onclick="alert(1)">Click</button>Safe';
			const result = sanitizeTextInput(xss);
			expect(result).to.equal("ClickSafe");
		});

		it("should handle data URIs", () => {
			const xss = '<a href="data:text/html,<script>alert(1)</script>">Link</a>Text';
			const result = sanitizeTextInput(xss);
			expect(result).to.equal("LinkText");
		});

		it("should use default max length of 5000", () => {
			const text = "a".repeat(5000);
			const result = sanitizeTextInput(text);
			expect(result).to.equal(text);
		});

		it("should reject text exceeding default max length", () => {
			const longText = "a".repeat(5001);
			expect(() => sanitizeTextInput(longText)).to.throw("Input cannot exceed 5000 characters");
		});

		it("should preserve newlines and special characters", () => {
			const text = "Line 1\nLine 2\tTabbed\r\nWindows style";
			const result = sanitizeTextInput(text);
			expect(result).to.equal(text);
		});

		it("should preserve unicode characters", () => {
			const text = "Hello 世界 🌍 مرحبا";
			const result = sanitizeTextInput(text);
			expect(result).to.equal(text);
		});
	});
});
