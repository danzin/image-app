import express from "express";
import { inject, injectable } from "tsyringe";
import { CommunityController } from "../controllers/community.controller";
import { AuthFactory } from "../middleware/authentication.middleware";
import { ValidationMiddleware } from "../middleware/validation.middleware";
import {
	createCommunitySchema,
	updateCommunitySchema,
	communityPublicIdSchema,
	communitySlugSchema,
	kickMemberSchema,
	communitySearchSchema,
} from "@/utils/schemas/community.schemas";
import upload from "@/config/multer";

@injectable()
export class CommunityRoutes {
	private readonly router = express.Router();
	private readonly auth = AuthFactory.bearerToken().handle();
	private readonly optionalAuth = AuthFactory.optionalBearerToken().handleOptional();

	constructor(@inject("CommunityController") private readonly communityController: CommunityController) {
		this.initializeRoutes();
	}

	private initializeRoutes(): void {
		// Get All Communities
		this.router.get(
			"/",
			this.optionalAuth,
			new ValidationMiddleware({ query: communitySearchSchema }).validate(),
			this.communityController.getAllCommunities
		);

		// Create Community
		this.router.post(
			"/",
			this.auth,
			upload.single("avatar"),
			new ValidationMiddleware({ body: createCommunitySchema }).validate(),
			this.communityController.createCommunity
		);

		// Get User Communities (My Communities)
		this.router.get("/me", this.auth, this.communityController.getUserCommunities);

		// Join Community
		this.router.post(
			"/:id/join",
			this.auth,
			new ValidationMiddleware({ params: communityPublicIdSchema }).validate(),
			this.communityController.joinCommunity
		);

		// Leave Community
		this.router.post(
			"/:id/leave",
			this.auth,
			new ValidationMiddleware({ params: communityPublicIdSchema }).validate(),
			this.communityController.leaveCommunity
		);

		// Get Community Feed
		this.router.get(
			"/:id/feed",
			this.optionalAuth,
			new ValidationMiddleware({ params: communityPublicIdSchema }).validate(),
			this.communityController.getCommunityFeed
		);

		// Get Community Members
		this.router.get(
			"/:slug/members",
			this.optionalAuth,
			new ValidationMiddleware({ params: communitySlugSchema }).validate(),
			this.communityController.getCommunityMembers
		);

		// Get Community Details (by slug)
		this.router.get(
			"/:slug",
			this.optionalAuth,
			new ValidationMiddleware({ params: communitySlugSchema }).validate(),
			this.communityController.getCommunityDetails
		);

		// Update Community
		this.router.patch(
			"/:id",
			this.auth,
			new ValidationMiddleware({ params: communityPublicIdSchema, body: updateCommunitySchema }).validate(),
			this.communityController.updateCommunity
		);

		// Delete Community
		this.router.delete(
			"/:id",
			this.auth,
			new ValidationMiddleware({ params: communityPublicIdSchema }).validate(),
			this.communityController.deleteCommunity
		);

		// Kick Member
		this.router.delete(
			"/:id/members/:userId",
			this.auth,
			new ValidationMiddleware({ params: kickMemberSchema }).validate(),
			this.communityController.kickMember
		);
	}

	public getRouter(): express.Router {
		return this.router;
	}
}
