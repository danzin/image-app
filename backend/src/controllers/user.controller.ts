import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service";
import { AuthService } from "../services/auth.service";
import { createError } from "../utils/errors";
import { injectable, inject } from "tsyringe";
import { cookieOptions } from "../config/cookieConfig";
import { CommandBus } from "../application/common/buses/command.bus";
import { QueryBus } from "../application/common/buses/query.bus";
import { RegisterUserCommand } from "../application/commands/users/register/register.command";
import { RegisterUserResult } from "../application/commands/users/register/register.handler";
import { GetMeQuery } from "../application/queries/users/getMe/getMe.query";
import { GetMeResult } from "../application/queries/users/getMe/getMe.handler";
import { LikeActionByPublicIdCommand } from "../application/commands/users/likeActionByPublicId/likeActionByPublicId.command";
import { GetWhoToFollowQuery } from "../application/queries/users/getWhoToFollow/getWhoToFollow.query";
import { GetWhoToFollowResult } from "../application/queries/users/getWhoToFollow/getWhoToFollow.handler";
import { UpdateAvatarCommand } from "../application/commands/users/updateAvatar/updateAvatar.command";
import { UpdateCoverCommand } from "../application/commands/users/updateCover/updateCover.command";
import { PublicUserDTO } from "../services/dto.service";
import { DeleteUserCommand } from "../application/commands/users/deleteUser/deleteUser.command";
import { FollowUserCommand } from "../application/commands/users/followUser/followUser.command";
import { FollowUserResult } from "../application/commands/users/followUser/followUser.handler";
import { UpdateProfileCommand } from "../application/commands/users/updateProfile/updateProfile.command";
import { ChangePasswordCommand } from "../application/commands/users/changePassword/changePassword.command";
import { GetUserByUsernameQuery } from "../application/queries/users/getUserByUsername/getUserByUsername.query";
import { GetUserByPublicIdQuery } from "../application/queries/users/getUserByPublicId/getUserByPublicId.query";
import { GetUsersQuery } from "../application/queries/users/getUsers/getUsers.query";
import { CheckFollowStatusQuery } from "../application/queries/users/checkFollowStatus/checkFollowStatus.query";
import { GetFollowersQuery } from "../application/queries/users/getFollowers/getFollowers.query";
import { GetFollowersResult } from "../application/queries/users/getFollowers/getFollowers.handler";
import { GetFollowingQuery } from "../application/queries/users/getFollowing/getFollowing.query";
import { GetFollowingResult } from "../application/queries/users/getFollowing/getFollowing.handler";
import { logger } from "../utils/winston";

/**
 * When using Dependency Injection in Express, there's a common
 * issue with route handles and `this` binding. When Express calls the route handlers,
 * it changes the context of `this` since the method is passed as a callback. So when I initialize the dependncy inside the constructor
 * like this.userService = userService, `this` context is lost and this.userService is undefined.
 *
 * 2 possible fixes:
 *  1 - manually bind all methods that will be used as route handlers:
 *     - this.register = this.register.bind(this);
 *     - etc etc, for every single method
 *  2 - user arrow functions, which automatically bind `this` and it doesn't get lost because they don't have their own 'this' context but use global one
 *     - this is the approach I used here
 */

@injectable()
export class UserController {
	constructor(
		@inject("UserService") private readonly userService: UserService,
		@inject("AuthService") private readonly authService: AuthService,
		@inject("CommandBus") private readonly commandBus: CommandBus,
		@inject("QueryBus") private readonly queryBus: QueryBus
	) {}

	register = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { username, email, password } = req.body;
			const command = new RegisterUserCommand(username, email, password);
			const { user, token } = await this.commandBus.dispatch<RegisterUserResult>(command);
			res.cookie("token", token, cookieOptions);
			res.status(201).json({ user, token }); // Return both user and token
		} catch (error) {
			next(error);
		}
	};

	// Refresh
	getMe = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			if (!decodedUser?.publicId) {
				return next(createError("UnauthorizedError", "User not authenticated."));
			}
			const query = new GetMeQuery(decodedUser.publicId as string);
			const { user, token } = await this.queryBus.execute<GetMeResult>(query);
			res.cookie("token", token, cookieOptions);
			res.status(200).json(user);
		} catch (error) {
			next(error);
		}
	};

	login = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { email, password } = req.body;
			const { user, token } = await this.authService.login(email, password);
			res.cookie("token", token, cookieOptions);
			res.status(200).json({ user, token }); // Return both user and token
		} catch (error) {
			next(error);
		}
	};

	logout = async (req: Request, res: Response, next: NextFunction) => {
		try {
			res.clearCookie("token");
			res.status(200).json({ message: "Logged out successfully" });
		} catch (error) {
			next(error);
		}
	};

	updateProfile = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			const userData = req.body;
			if (userData.password || userData.email || userData.isAdmin || userData.avatar || userData.cover) {
				return next(createError("ValidationError", "You can not do that."));
			}
			if (!decodedUser) {
				return next(createError("UnauthorizedError", "User not authenticated."));
			}
			if (!decodedUser.publicId) return next(createError("UnauthorizedError", "User not authenticated."));

			const command = new UpdateProfileCommand(decodedUser.publicId, userData);
			const updatedUser = await this.commandBus.dispatch<PublicUserDTO>(command);
			res.status(200).json(updatedUser);
		} catch (error) {
			next(error);
		}
	};

	changePassword = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			const { currentPassword, newPassword } = req.body; // already validated by Zod middleware

			if (!decodedUser) {
				return next(createError("UnauthorizedError", "User not authenticated."));
			}
			if (!decodedUser.publicId) return next(createError("UnauthorizedError", "User not authenticated."));

			const command = new ChangePasswordCommand(decodedUser.publicId, currentPassword, newPassword);
			await this.commandBus.dispatch(command);

			// res.clearCookie('token'); // might clear cookies on password change to force re-login

			res.status(200).json({ message: "Password changed successfully." });
		} catch (error) {
			next(error);
		}
	};

	updateAvatar = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			const file = req.file?.path;
			if (!file) throw createError("ValidationError", "No file provided");
			if (!decodedUser) {
				return next(createError("UnauthorizedError", "User not authenticated."));
			}
			if (!decodedUser.publicId) return next(createError("UnauthorizedError", "User not authenticated."));

			const command = new UpdateAvatarCommand(decodedUser.publicId, file);
			const updatedUserDTO = await this.commandBus.dispatch<PublicUserDTO>(command);

			res.status(200).json(updatedUserDTO);
		} catch (error) {
			next(error);
		}
	};

	updateCover = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			const file = req.file?.path;
			if (!file) throw createError("ValidationError", "No file provided");
			if (!decodedUser) {
				return next(createError("UnauthorizedError", "User not authenticated."));
			}
			if (!decodedUser.publicId) return next(createError("UnauthorizedError", "User not authenticated."));

			const command = new UpdateCoverCommand(decodedUser.publicId, file);
			const updatedUserDTO = await this.commandBus.dispatch<PublicUserDTO>(command);

			res.status(200).json(updatedUserDTO);
		} catch (error) {
			next(error);
		}
	};

	getUserByUsername = async (req: Request, res: Response): Promise<void> => {
		try {
			const { username } = req.params;
			const query = new GetUserByUsernameQuery(username);
			const userDTO = await this.queryBus.execute<PublicUserDTO>(query);

			res.status(200).json(userDTO);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			if (errorMessage.includes("not found")) {
				res.status(404).json({ error: "User not found" });
			} else {
				res.status(500).json({ error: errorMessage });
			}
		}
	};

	getUserByPublicId = async (req: Request, res: Response): Promise<void> => {
		try {
			const { publicId } = req.params;
			const query = new GetUserByPublicIdQuery(publicId);
			const userDTO = await this.queryBus.execute<PublicUserDTO>(query);

			res.status(200).json(userDTO);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			if (errorMessage.includes("not found")) {
				res.status(404).json({ error: "User not found" });
			} else {
				res.status(500).json({ error: errorMessage });
			}
		}
	};

	/**
	 * Follow a user by their public ID
	 */
	followUserByPublicId = async (req: Request, res: Response): Promise<void> => {
		try {
			const { publicId } = req.params;
			const followerPublicId = req.decodedUser?.publicId;

			if (!followerPublicId) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}

			const command = new FollowUserCommand(followerPublicId, publicId);
			const result = await this.commandBus.dispatch<FollowUserResult>(command);
			res.status(200).json(result);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			if (errorMessage.includes("not found")) {
				res.status(404).json({ error: "User not found" });
			} else if (errorMessage.includes("already following")) {
				res.status(400).json({ error: "Already following this user" });
			} else if (errorMessage.includes("follow yourself")) {
				res.status(400).json({ error: "Cannot follow yourself" });
			} else {
				res.status(500).json({ error: errorMessage });
			}
		}
	};

	/**
	 * Unfollow a user by their public ID
	 */
	unfollowUserByPublicId = async (req: Request, res: Response): Promise<void> => {
		try {
			const { publicId } = req.params;
			const followerPublicId = req.decodedUser?.publicId;

			if (!followerPublicId) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}

			const command = new FollowUserCommand(followerPublicId, publicId);
			const result = await this.commandBus.dispatch<FollowUserResult>(command);
			res.status(200).json(result);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			if (errorMessage.includes("not found")) {
				res.status(404).json({ error: "User not found" });
			} else if (errorMessage.includes("not following")) {
				res.status(400).json({ error: "Not following this user" });
			} else {
				res.status(500).json({ error: errorMessage });
			}
		}
	};

	/**
	 * Check if current user follows another user
	 */
	checkFollowStatus = async (req: Request, res: Response): Promise<void> => {
		try {
			const { publicId } = req.params;
			const followerPublicId = req.decodedUser?.publicId;

			if (!followerPublicId) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}

			const query = new CheckFollowStatusQuery(followerPublicId, publicId);
			const isFollowing = await this.queryBus.execute<boolean>(query);
			res.status(200).json({ isFollowing });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			res.status(500).json({ error: errorMessage });
		}
	};

	/**
	 * Get a user's followers list (paginated)
	 */
	getFollowers = async (req: Request, res: Response): Promise<void> => {
		try {
			const { publicId } = req.params;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;

			const query = new GetFollowersQuery(publicId, page, limit);
			const result = await this.queryBus.execute<GetFollowersResult>(query);
			res.status(200).json(result);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (errorMessage.includes("not found")) {
				res.status(404).json({ error: "User not found" });
			} else {
				res.status(500).json({ error: errorMessage });
			}
		}
	};

	/**
	 * Get a user's following list (paginated)
	 */
	getFollowing = async (req: Request, res: Response): Promise<void> => {
		try {
			const { publicId } = req.params;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;

			const query = new GetFollowingQuery(publicId, page, limit);
			const result = await this.queryBus.execute<GetFollowingResult>(query);
			res.status(200).json(result);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (errorMessage.includes("not found")) {
				res.status(404).json({ error: "User not found" });
			} else {
				res.status(500).json({ error: errorMessage });
			}
		}
	};

	/**
	 * Delete current user's account (self-deletion)
	 */
	deleteMyAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const userPublicId = req.decodedUser?.publicId;

			if (!userPublicId) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}

			const command = new DeleteUserCommand(userPublicId);
			await this.commandBus.dispatch(command);

			res.clearCookie("token");
			res.status(200).json({ message: "Account deleted successfully" });
		} catch (error) {
			next(error);
		}
	};

	// user getters
	getUsers = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const options = { ...req.query } as any;
			const query = new GetUsersQuery(options);
			const result = await this.queryBus.execute(query);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	// User actions
	likeActionByPublicId = async (req: Request, res: Response, next: NextFunction) => {
		try {
			let { publicId } = req.params;
			const userPublicId = req.decodedUser?.publicId;

			// strip file extension for backward compatibility
			publicId = publicId.replace(/\.[a-z0-9]{2,5}$/i, "");

			logger.info(`[LIKEACTION]: User public ID: ${userPublicId}, Post public ID: ${publicId}`);
			if (!userPublicId) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}
			logger.info(publicId);
			if (!userPublicId) {
				return next(createError("UnauthorizedError", "User not authenticated."));
			}
			const command = new LikeActionByPublicIdCommand(userPublicId, publicId);
			const result = await this.commandBus.dispatch(command);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	// Get suggested users to follow
	getWhoToFollow = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			if (!decodedUser?.publicId) {
				return next(createError("UnauthorizedError", "User not authenticated."));
			}

			const limit = parseInt(req.query.limit as string) || 5;
			if (limit > 20) {
				return next(createError("ValidationError", "Limit cannot exceed 20"));
			}

			const query = new GetWhoToFollowQuery(decodedUser.publicId as string, limit);
			const result = await this.queryBus.execute<GetWhoToFollowResult>(query);

			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};
}
