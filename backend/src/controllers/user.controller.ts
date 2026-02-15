import { Request, Response, NextFunction } from "express";
import { AuthService } from "@/services/auth.service";
import { createError } from "@/utils/errors";
import { injectable, inject } from "tsyringe";
import { accessCookieOptions, authCookieNames, clearAuthCookieOptions, refreshCookieOptions } from "@/config/cookieConfig";
import { CommandBus } from "@/application/common/buses/command.bus";
import { QueryBus } from "@/application/common/buses/query.bus";
import { RegisterUserCommand } from "@/application/commands/users/register/register.command";
import { RegisterUserResult } from "@/application/commands/users/register/register.handler";
import { GetMeQuery } from "@/application/queries/users/getMe/getMe.query";
import { GetMeResult } from "@/application/queries/users/getMe/getMe.handler";
import { GetAccountInfoQuery } from "@/application/queries/users/getAccountInfo/getAccountInfo.query";
import { GetAccountInfoResult } from "@/application/queries/users/getAccountInfo/getAccountInfo.handler";
import { LikeActionByPublicIdCommand } from "@/application/commands/users/likeActionByPublicId/likeActionByPublicId.command";
import { GetWhoToFollowQuery } from "@/application/queries/users/getWhoToFollow/getWhoToFollow.query";
import { GetWhoToFollowResult } from "@/application/queries/users/getWhoToFollow/getWhoToFollow.handler";
import {
	GetHandleSuggestionsQuery,
	HandleSuggestionContext,
} from "@/application/queries/users/getHandleSuggestions/getHandleSuggestions.query";
import { AdminUserDTO, AuthenticatedUserDTO, HandleSuggestionDTO, PublicUserDTO } from "@/services/dto.service";
import { UpdateAvatarCommand } from "@/application/commands/users/updateAvatar/updateAvatar.command";
import { UpdateCoverCommand } from "@/application/commands/users/updateCover/updateCover.command";
import { DeleteUserCommand } from "@/application/commands/users/deleteUser/deleteUser.command";
import { FollowUserCommand } from "@/application/commands/users/followUser/followUser.command";
import { FollowUserResult } from "@/application/commands/users/followUser/followUser.handler";
import { UpdateProfileCommand } from "@/application/commands/users/updateProfile/updateProfile.command";
import { ChangePasswordCommand } from "@/application/commands/users/changePassword/changePassword.command";
import { GetUserByHandleQuery } from "@/application/queries/users/getUserByUsername/getUserByUsername.query";
import { GetUserByPublicIdQuery } from "@/application/queries/users/getUserByPublicId/getUserByPublicId.query";
import { GetUsersQuery } from "@/application/queries/users/getUsers/getUsers.query";
import { CheckFollowStatusQuery } from "@/application/queries/users/checkFollowStatus/checkFollowStatus.query";
import { GetFollowersQuery } from "@/application/queries/users/getFollowers/getFollowers.query";
import { GetFollowersResult } from "@/application/queries/users/getFollowers/getFollowers.handler";
import { GetFollowingQuery } from "@/application/queries/users/getFollowing/getFollowing.query";
import { GetFollowingResult } from "@/application/queries/users/getFollowing/getFollowing.handler";
import { RequestPasswordResetCommand } from "@/application/commands/users/requestPasswordReset/RequestPasswordResetCommand";
import { ResetPasswordCommand } from "@/application/commands/users/resetPassword/ResetPasswordCommand";
import { VerifyEmailCommand } from "@/application/commands/users/verifyEmail/VerifyEmailCommand";
import { PaginationOptions } from "@/types";

import { logger } from "@/utils/winston";

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
		@inject("AuthService") private readonly authService: AuthService,
		@inject("CommandBus") private readonly commandBus: CommandBus,
		@inject("QueryBus") private readonly queryBus: QueryBus,
	) {}

	private getRequestContext(req: Request): { ip: string; userAgent: string } {
		const cloudflareIp = req.headers["cf-connecting-ip"];
		const ip = typeof cloudflareIp === "string" && cloudflareIp.length > 0 ? cloudflareIp : req.ip || "unknown";
		const userAgent = req.get("User-Agent") || "unknown";
		return { ip, userAgent };
	}

	private toSessionUser(user: AuthenticatedUserDTO | AdminUserDTO): {
		publicId: string;
		email: string;
		handle: string;
		username: string;
		isAdmin: boolean;
	} {
		const withAdmin = user as { isAdmin?: boolean };
		return {
			publicId: user.publicId,
			email: user.email,
			handle: user.handle,
			username: user.username,
			isAdmin: typeof withAdmin.isAdmin === "boolean" ? withAdmin.isAdmin : false,
		};
	}

	private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
		res.cookie(authCookieNames.accessToken, accessToken, accessCookieOptions);
		res.cookie(authCookieNames.refreshToken, refreshToken, refreshCookieOptions);
		// cleanup legacy cookie used by previous auth flow
		res.clearCookie(authCookieNames.legacyToken, clearAuthCookieOptions);
	}

	private clearAuthCookies(res: Response): void {
		res.clearCookie(authCookieNames.accessToken, clearAuthCookieOptions);
		res.clearCookie(authCookieNames.refreshToken, clearAuthCookieOptions);
		res.clearCookie(authCookieNames.legacyToken, clearAuthCookieOptions);
	}

	register = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { handle, username, email, password } = req.body;
			const { ip, userAgent } = this.getRequestContext(req);
			const command = new RegisterUserCommand(handle, username, email, password, undefined, undefined, ip);
			const { user } = await this.commandBus.dispatch<RegisterUserResult>(command);
			const { accessToken, refreshToken } = await this.authService.issueTokensForUser(this.toSessionUser(user), {
				ip,
				userAgent,
			});
			this.setAuthCookies(res, accessToken, refreshToken);
			res.status(201).json({ user });
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
			const { user } = await this.queryBus.execute<GetMeResult>(query);
			res.status(200).json(user);
		} catch (error) {
			next(error);
		}
	};

	login = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { email, password } = req.body;
			const { user, accessToken, refreshToken } = await this.authService.login(email, password, this.getRequestContext(req));
			this.setAuthCookies(res, accessToken, refreshToken);
			res.status(200).json({ user });
		} catch (error) {
			next(error);
		}
	};

	refresh = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const refreshToken = req.cookies?.[authCookieNames.refreshToken];
			if (typeof refreshToken !== "string" || refreshToken.length === 0) {
				return next(createError("AuthenticationError", "Refresh token missing"));
			}

			const { user, accessToken, refreshToken: nextRefreshToken } = await this.authService.refreshSession(
				refreshToken,
				this.getRequestContext(req),
			);
			this.setAuthCookies(res, accessToken, nextRefreshToken);
			res.status(200).json({ user });
		} catch (error) {
			next(error);
		}
	};

	logout = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const refreshToken = req.cookies?.[authCookieNames.refreshToken];
			const accessToken = req.cookies?.[authCookieNames.accessToken] || req.cookies?.[authCookieNames.legacyToken];
			const revocationTasks: Promise<void>[] = [];

			if (typeof refreshToken === "string" && refreshToken.length > 0) {
				revocationTasks.push(this.authService.revokeSessionByRefreshToken(refreshToken));
			} else if (typeof accessToken === "string" && accessToken.length > 0) {
				revocationTasks.push(this.authService.revokeSessionByAccessToken(accessToken));
			}

			if (revocationTasks.length > 0) {
				const revocationResults = await Promise.allSettled(revocationTasks);
				for (const result of revocationResults) {
					if (result.status === "rejected") {
						const reasonMessage = result.reason instanceof Error ? result.reason.message : String(result.reason);
						logger.warn(`[AUTH] Logout revocation failed: ${reasonMessage}`);
					}
				}
			}

			this.clearAuthCookies(res);
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
			await this.authService.revokeAllSessionsForUser(decodedUser.publicId);
			this.clearAuthCookies(res);

			res.status(200).json({ message: "Password changed successfully. Please log in again." });
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

	getUserByHandle = async (req: Request, res: Response): Promise<void> => {
		try {
			const { handle } = req.params;
			const query = new GetUserByHandleQuery(handle);
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

	getAccountInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const userPublicId = req.decodedUser?.publicId;

			if (!userPublicId) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}

			const query = new GetAccountInfoQuery(userPublicId);
			const result = await this.queryBus.execute<GetAccountInfoResult>(query);
			res.status(200).json(result.accountInfo);
		} catch (error) {
			next(error);
		}
	};

	deleteMyAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const userPublicId = req.decodedUser?.publicId;
			const { password } = req.body;

			if (!userPublicId) {
				res.status(401).json({ error: "Authentication required" });
				return;
			}

			const command = new DeleteUserCommand(userPublicId, password);
			await this.commandBus.dispatch(command);
			await this.authService.revokeAllSessionsForUser(userPublicId);

			this.clearAuthCookies(res);
			res.status(200).json({ message: "Account deleted successfully" });
		} catch (error) {
			next(error);
		}
	};

	requestPasswordReset = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { email } = req.body;
			const command = new RequestPasswordResetCommand(email);
			await this.commandBus.dispatch(command);
			res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
		} catch (error) {
			next(error);
		}
	};

	resetPassword = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { token, newPassword } = req.body;
			const command = new ResetPasswordCommand(token, newPassword);
			await this.commandBus.dispatch(command);
			res.status(200).json({ message: "Password reset successful" });
		} catch (error) {
			next(error);
		}
	};

	verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { email, token } = req.body;
			const command = new VerifyEmailCommand(email, token);
			const user = await this.commandBus.dispatch(command);
			res.status(200).json(user);
		} catch (error) {
			next(error);
		}
	};

	getUsers = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const options = { ...req.query } as unknown as PaginationOptions;
			const query = new GetUsersQuery(options);
			const result = await this.queryBus.execute(query);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

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

	getHandleSuggestions = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const queryValue = typeof req.query.q === "string" ? req.query.q : "";
			const context = req.query.context as HandleSuggestionContext;
			const limit = parseInt(req.query.limit as string) || 8;
			const viewerPublicId = req.decodedUser?.publicId;

			const query = new GetHandleSuggestionsQuery(queryValue, context, limit, viewerPublicId);
			const result = await this.queryBus.execute<HandleSuggestionDTO[]>(query);

			res.status(200).json({ users: result });
		} catch (error) {
			next(error);
		}
	};
}
