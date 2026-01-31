import { describe, it } from "mocha";
import { expect } from "chai";
import { DTOService } from "@/services/dto.service";

const basePost = {
	body: "",
	slug: "",
	image: null,
	tags: [],
	commentsCount: 0,
	viewsCount: 0,
	createdAt: new Date(),
};

describe("DTOService.toPostDTO", () => {
	const service = new DTOService();

	it("prefers populated user snapshot when available", () => {
		const dto = service.toPostDTO({
			...basePost,
			publicId: "post-1",
			likesCount: 3,
			user: {
				publicId: "user-123",
				username: "photoFan",
				avatar: "avatar.png",
			},
			author: {
				publicId: "user-legacy",
				username: "legacyName",
				avatarUrl: "legacy.png",
			},
		});

		expect(dto.user).to.deep.equal({
			publicId: "user-123",
			username: "photoFan",
			avatar: "avatar.png",
		});
		expect(dto.likes).to.equal(3);
	});

	it("falls back to embedded author snapshot when user is missing", () => {
		const dto = service.toPostDTO({
			...basePost,
			publicId: "post-2",
			likesCount: 0,
			author: {
				publicId: "author-456",
				username: "snapName",
				avatarUrl: "snap.png",
			},
		});

		expect(dto.user).to.deep.equal({
			publicId: "author-456",
			username: "snapName",
			avatar: "snap.png",
		});
	});
});
