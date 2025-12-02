import { IQueryHandler } from "../../../../application/common/interfaces/query-handler.interface";
import { GetMeQuery } from "../../../queries/users/getMe/getMe.query";
import { inject, injectable } from "tsyringe";
import { IUserReadRepository } from "../../../../repositories/interfaces";
import { createError } from "../../../../utils/errors";
import { IUser } from "../../../../types/index.js";
import { DTOService } from "../../../../services/dto.service";
import jwt from "jsonwebtoken";

export interface GetMeResult {
	user: any;
	token: string;
}

@injectable()
export class GetMeQueryHandler implements IQueryHandler<GetMeQuery, GetMeResult> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(query: GetMeQuery): Promise<GetMeResult> {
		try {
			const user = await this.userReadRepository.findByPublicId(query.publicId);
			if (!user) {
				throw createError("PathError", "User not found");
			}
			const token = this.generateToken(user);

			// return admin DTO for admin users, authenticated DTO for regular users
			const userDTO = user.isAdmin ? this.dtoService.toAdminDTO(user) : this.dtoService.toAuthenticatedUserDTO(user);

			return { user: userDTO, token };
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
		const payload = {
			publicId: user.publicId,
			email: user.email,
			username: user.username,
			isAdmin: user.isAdmin,
		};
		const secret = process.env.JWT_SECRET;
		if (!secret) throw createError("ConfigError", "JWT secret is not configured");
		return jwt.sign(payload, secret, { expiresIn: "12h" });
	}
}
