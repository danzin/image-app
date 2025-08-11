import { IQueryHandler } from "../../../../application/common/interfaces/query-handler.interface";
import { GetMeQuery } from "../../../queries/users/getMe/getMe.query";
import { inject, injectable } from "tsyringe";
import { UserRepository } from "../../../../repositories/user.repository";
import { createError } from "../../../../utils/errors";
import { IUser } from "../../../../types/index.js";
import { UserDTOService } from "../../../../services/dto.service";
import jwt from "jsonwebtoken";

export interface GetMeResult {
	user: any;
	token: string;
}

@injectable()
export class GetMeQueryHandler implements IQueryHandler<GetMeQuery, GetMeResult> {
	constructor(
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("UserDTOService") private readonly dtoService: UserDTOService
	) {}

	async execute(query: GetMeQuery): Promise<GetMeResult> {
		try {
			const user = await this.userRepository.findById(query.userId);
			if (!user) {
				throw createError("PathError", "User not found");
			}

			const token = this.generateToken(user);
			return { user: this.dtoService.toPublicDTO(user), token };
		} catch (error) {
			if (error instanceof Error) {
				throw createError(error.name, error.message);
			}
			throw createError("UnknownError", "An unknown error occurred");
		}
	}

	/**
	 * Generates a JWT token for a user.
	 * @param user - The user object
	 * @returns A signed JWT token
	 */
	private generateToken(user: IUser): string {
		const payload = { id: user._id, email: user.email, username: user.username, isAdmin: user.isAdmin };
		const secret = process.env.JWT_SECRET;
		if (!secret) throw createError("ConfigError", "JWT secret is not configured");

		return jwt.sign(payload, secret, { expiresIn: "12h" });
	}
}
