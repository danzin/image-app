import { injectable, inject } from "tsyringe";
import jwt from "jsonwebtoken";
import { UserRepository } from "../repositories/user.repository";
import { DTOService, PublicUserDTO, AdminUserDTO } from "./dto.service";
import { createError } from "../utils/errors";
import { IUser } from "../types";

@injectable()
export class AuthService {
	constructor(
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	/**
	 * Generates a JWT token for a user.
	 * @param user - The user object
	 * @returns A signed JWT token
	 */
	generateToken(user: IUser): string {
		// Token exposes only public-facing identifiers
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

	/**
	 * Authenticates a user and returns their data along with a token.
	 * @param email - User's email
	 * @param password - User's password
	 * @returns The authenticated user and token
	 */
	async login(email: string, password: string): Promise<{ user: PublicUserDTO | AdminUserDTO; token: string }> {
		try {
			const user = await this.userRepository.findByEmail(email);
			if (!user || !(await user.comparePassword?.(password))) {
				throw createError("AuthenticationError", "Invalid email or password");
			}

			const token = this.generateToken(user);

			// Assign appropriate DTO
			const userDTO = user.isAdmin ? this.dtoService.toAdminDTO(user) : this.dtoService.toPublicDTO(user);

			return { user: userDTO, token };
		} catch (error) {
			if (typeof error === "object" && error !== null && "name" in error && "message" in error) {
				throw createError(
					(error as { name: string; message: string }).name,
					(error as { name: string; message: string }).message
				);
			} else {
				throw createError("InternalServerError", "An unknown error occurred.");
			}
		}
	}
}
