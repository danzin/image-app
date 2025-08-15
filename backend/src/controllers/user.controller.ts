import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service";
import { DTOService } from "../services/dto.service";
import { createError } from "../utils/errors";
import { injectable, inject } from "tsyringe";
import { FollowService } from "../services/follow.service";
import { IUser, IImage } from "../types";
import { cookieOptions } from "../config/cookieConfig";
import { CommandBus } from "../application/common/buses/command.bus";
import { QueryBus } from "../application/common/buses/query.bus";
import { RegisterUserCommand } from "../application/commands/users/register/register.command";
import { RegisterUserResult } from "../application/commands/users/register/register.handler";
import { GetMeQuery } from "../application/queries/users/getMe/getMe.query";
import { GetMeResult } from "../application/queries/users/getMe/getMe.handler";
import { LikeActionCommand } from "../application/commands/users/likeAction/likeAction.command";
import { LikeActionByPublicIdCommand } from "../application/commands/users/likeActionByPublicId/likeActionByPublicId.command";

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
 *  2 - user arrow functions, which automatically bind `this` and it doesn't get lost because they don't have their own 'this' context.
 */

@injectable()
export class UserController {
	constructor(
		@inject("UserService") private readonly userService: UserService,
		@inject("FollowService") private readonly followService: FollowService,
		@inject("CommandBus") private readonly commandBus: CommandBus,
		@inject("QueryBus") private readonly queryBus: QueryBus,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	//Register and login users
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
			if (!decodedUser) {
				return next(createError("UnauthorizedError", "User not authenticated."));
			}
			const query = new GetMeQuery(decodedUser.id);
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
			const { user, token } = await this.userService.login(email, password);
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

	// Profile updates
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
			const updatedUser = await this.userService.updateProfile(decodedUser.id, userData, decodedUser as IUser);
			res.status(200).json(updatedUser);
		} catch (error) {
			next(error);
		}
	};

	changePassword = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			const { currentPassword, newPassword } = req.body;

			if (!currentPassword || !newPassword) {
				return next(createError("ValidationError", "Current password and new password are required."));
			}
			if (!decodedUser) {
				return next(createError("UnauthorizedError", "User not authenticated."));
			}
			await this.userService.changePassword(decodedUser.id, currentPassword, newPassword);

			// res.clearCookie('token'); // Might clear cookies on password change to force re-login

			res.status(200).json({ message: "Password changed successfully." });
		} catch (error) {
			next(error);
		}
	};

	updateAvatar = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			console.log("decodedUser in updateAvatar", decodedUser);
			const file = req.file?.buffer;
			if (!file) throw createError("ValidationError", "No file provided");
			if (!decodedUser) {
				return next(createError("UnauthorizedError", "User not authenticated."));
			}
			await this.userService.updateAvatar(decodedUser.id, file);
			res.status(200).json({ message: "Avatar updated successfully" });
		} catch (error) {
			next(error);
		}
	};

	updateCover = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			console.log("decodedUser in updateAvatar", decodedUser);

			const file = req.file?.buffer;
			if (!file) throw createError("ValidationError", "No file provided");
			if (!decodedUser) {
				return next(createError("UnauthorizedError", "User not authenticated."));
			}
			await this.userService.updateCover(decodedUser.id, file);
			res.status(200).json({ message: "Cover updated successfully" });
		} catch (error) {
			next(error);
		}
	};

	/**
	 * Get user profile by username (public endpoint)
	 */
	getUserByUsername = async (req: Request, res: Response): Promise<void> => {
		try {
			const { username } = req.params;
			const user = await this.userService.getUserByUsername(username);

			// Return public DTO (no sensitive data)
			const userDTO = this.dtoService.toPublicDTO(user);

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
	 * Get user profile by public ID (for API integrations)
	 */
	getUserByPublicId = async (req: Request, res: Response): Promise<void> => {
		try {
			const { publicId } = req.params;
			const user = await this.userService.getUserByPublicId(publicId);

			// Return public DTO (no sensitive data)
			const userDTO = this.dtoService.toPublicDTO(user);

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
			const followerId = req.decodedUser?.id;

			if (!followerId) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}

			const result = await this.userService.followUserByPublicId(followerId, publicId);
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
			const followerId = req.decodedUser?.id;

			if (!followerId) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}

			const result = await this.userService.unfollowUserByPublicId(followerId, publicId);
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
			const followerId = req.decodedUser?.id;

			if (!followerId) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}

			const isFollowing = await this.userService.checkFollowStatusByPublicId(followerId, publicId);
			res.status(200).json({ isFollowing });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			res.status(500).json({ error: errorMessage });
		}
	};

	/**
	 * Like an image by its public ID
	 */
	likeImageByPublicId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { publicId } = req.params;
			const userId = req.decodedUser?.id;

			if (!userId) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}

			const command = new LikeActionByPublicIdCommand(userId, publicId);
			const result = await this.commandBus.dispatch<IImage>(command);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	/**
	 * Unlike an image by its public ID
	 */
	unlikeImageByPublicId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { publicId } = req.params;
			const userId = req.decodedUser?.id;

			if (!userId) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}

			const command = new LikeActionByPublicIdCommand(userId, publicId);
			const result = await this.commandBus.dispatch<IImage>(command);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	/**
	 * Delete current user's account (self-deletion)
	 */
	deleteMyAccount = async (req: Request, res: Response): Promise<void> => {
		try {
			const userId = req.decodedUser?.id;

			if (!userId) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}

			await this.userService.deleteMyAccount(userId);
			res.status(200).json({ message: "Account deleted successfully" });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			res.status(500).json({ error: errorMessage });
		}
	};

	//User getters
	getUsers = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const options = { ...req.query } as any;
			const result = await this.userService.getUsers(options);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	getUserById = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			const user = await this.userService.getUserById(req.params.userId, decodedUser as IUser);
			res.status(200).json(user);
		} catch (error) {
			next(error);
		}
	};

	// User actions
	likeAction = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			const { imageId } = req.params;
			console.log(imageId);
			if (!decodedUser) {
				return next(createError("UnauthorizedError", "User not authenticated."));
			}
			const command = new LikeActionCommand(decodedUser.id, imageId);
			const result = await this.commandBus.dispatch(command);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	likeActionByPublicId = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			const { publicId } = req.params;
			console.log(publicId);
			if (!decodedUser) {
				return next(createError("UnauthorizedError", "User not authenticated."));
			}
			const command = new LikeActionByPublicIdCommand(decodedUser.id, publicId);
			const result = await this.commandBus.dispatch<IImage>(command);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	followAction = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			const { followeeId } = req.params;
			console.log(followeeId);
			if (!decodedUser) {
				return next(createError("UnauthorizedError", "User not authenticated."));
			}
			const result = await this.userService.followAction(decodedUser.id, followeeId);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};
}
