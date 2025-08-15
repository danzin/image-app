import { inject, injectable } from "tsyringe";
import { RegisterUserCommand } from "./register.command";
import { UserRepository } from "../../../../repositories/user.repository";
import jwt from "jsonwebtoken";
import { createError } from "../../../../utils/errors";
import { ICommandHandler } from "../../../../application/common/interfaces/command-handler.interface";
import { IUser } from "../../../../types/index";
import { DTOService } from "../../../../services/dto.service";

export interface RegisterUserResult {
	user: any;
	token: string;
}

@injectable()
export class RegisterUserCommandHandler implements ICommandHandler<RegisterUserCommand, RegisterUserResult> {
	constructor(
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}
	// Trying and keeping the logic from my current userservice method, see how it goes

	async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
		try {
			const user = await this.userRepository.create({
				username: command.username,
				email: command.email,
				password: command.password,
				avatar: command.avatar || "",
				cover: command.cover || "",
			});

			const token = this.generateToken(user);
			const userDTO = this.dtoService.toPublicDTO(user);
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
			id: user.publicId,
			email: user.email,
			username: user.username,
			isAdmin: user.isAdmin,
		};
		const secret = process.env.JWT_SECRET;
		if (!secret) throw createError("ConfigError", "JWT secret is not configured");

		return jwt.sign(payload, secret, { expiresIn: "12h" });
	}
}
