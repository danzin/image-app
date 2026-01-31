import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { CommandBus } from "@/application/common/buses/command.bus";
import { QueryBus } from "@/application/common/buses/query.bus";
import { CreateCommunityCommand } from "@/application/commands/community/createCommunity/createCommunity.command";
import { JoinCommunityCommand } from "@/application/commands/community/joinCommunity/joinCommunity.command";
import { LeaveCommunityCommand } from "@/application/commands/community/leaveCommunity/leaveCommunity.command";
import { GetCommunityDetailsQuery } from "@/application/queries/community/getCommunityDetails/getCommunityDetails.query";
import { GetUserCommunitiesQuery } from "@/application/queries/community/getUserCommunities/getUserCommunities.query";
import { GetCommunityFeedQuery } from "@/application/queries/community/getCommunityFeed/getCommunityFeed.query";
import { GetAllCommunitiesQuery } from "@/application/queries/community/getAllCommunities/getAllCommunities.query";
import { GetCommunityMembersQuery } from "@/application/queries/community/getCommunityMembers/getCommunityMembers.query";
import { UpdateCommunityCommand } from "@/application/commands/community/updateCommunity/updateCommunity.command";
import { DeleteCommunityCommand } from "@/application/commands/community/deleteCommunity/deleteCommunity.command";
import { KickMemberCommand } from "@/application/commands/community/kickMember/kickMember.command";
import { createError } from "@/utils/errors";
import { ICommunity } from "@/types";

@injectable()
export class CommunityController {
	constructor(
		@inject("CommandBus") private readonly commandBus: CommandBus,
		@inject("QueryBus") private readonly queryBus: QueryBus,
	) {}

	getAllCommunities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;
			const search = req.query.search as string;
			const viewerPublicId = req.decodedUser?.publicId;

			const query = new GetAllCommunitiesQuery(page, limit, search, viewerPublicId);
			const result = await this.queryBus.execute(query);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	createCommunity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { decodedUser } = req;
			const { name, description } = req.body;
			const avatarPath = req.file?.path;

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User information missing");
			}

			const command = new CreateCommunityCommand(name, description, decodedUser.publicId, avatarPath);
			const community = (await this.commandBus.dispatch(command)) as ICommunity;
			res.status(201).json(community);
		} catch (error) {
			next(error);
		}
	};

	joinCommunity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { decodedUser } = req;
			const { id } = req.params;

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User information missing");
			}

			const command = new JoinCommunityCommand(id, decodedUser.publicId);
			await this.commandBus.dispatch(command);
			res.status(200).json({ message: "Joined community successfully" });
		} catch (error) {
			next(error);
		}
	};

	leaveCommunity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { decodedUser } = req;
			const { id } = req.params;

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User information missing");
			}

			const command = new LeaveCommunityCommand(id, decodedUser.publicId);
			await this.commandBus.dispatch(command);
			res.status(200).json({ message: "Left community successfully" });
		} catch (error) {
			next(error);
		}
	};

	getCommunityDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { slug } = req.params;
			const viewerPublicId = req.decodedUser?.publicId;
			const query = new GetCommunityDetailsQuery(slug, viewerPublicId);
			const community = (await this.queryBus.execute(query)) as ICommunity;
			res.status(200).json(community);
		} catch (error) {
			next(error);
		}
	};

	getUserCommunities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { decodedUser } = req;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User information missing");
			}

			const query = new GetUserCommunitiesQuery(decodedUser.publicId, page, limit);
			const result = await this.queryBus.execute(query);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	getCommunityFeed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { id } = req.params;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;

			const query = new GetCommunityFeedQuery(id, page, limit);
			const result = await this.queryBus.execute(query);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	updateCommunity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { decodedUser } = req;
			const { id } = req.params;
			const updates = req.body;

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User information missing");
			}

			const command = new UpdateCommunityCommand(id, decodedUser.publicId, updates);
			const community = (await this.commandBus.dispatch(command)) as ICommunity;
			res.status(200).json(community);
		} catch (error) {
			next(error);
		}
	};

	deleteCommunity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { decodedUser } = req;
			const { id } = req.params;

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User information missing");
			}

			const command = new DeleteCommunityCommand(id, decodedUser.publicId);
			await this.commandBus.dispatch(command);
			res.status(200).json({ message: "Community deleted successfully" });
		} catch (error) {
			next(error);
		}
	};

	getCommunityMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { slug } = req.params;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;

			const query = new GetCommunityMembersQuery(slug, page, limit);
			const result = await this.queryBus.execute(query);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	kickMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { decodedUser } = req;
			const { id, userId } = req.params;

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User information missing");
			}

			const command = new KickMemberCommand(id, decodedUser.publicId, userId);
			await this.commandBus.dispatch(command);
			res.status(200).json({ message: "Member kicked successfully" });
		} catch (error) {
			next(error);
		}
	};
}
