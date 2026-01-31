import { inject, injectable } from "tsyringe";
import { RegisterUserCommand } from "./register.command";
import { IUserWriteRepository } from "@/repositories/interfaces/IUserWriteRepository";
import jwt from "jsonwebtoken";
import { createError } from "@/utils/errors";
import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { IUser } from "@/types/index";
import { DTOService, AuthenticatedUserDTO } from "@/services/dto.service";
import { EmailService } from "@/services/email.service";
import crypto from "crypto";

export interface RegisterUserResult {
	user: AuthenticatedUserDTO;
	token: string;
}

@injectable()
export class RegisterUserCommandHandler implements ICommandHandler<RegisterUserCommand, RegisterUserResult> {
	constructor(
		@inject("UserWriteRepository") private readonly userWriteRepository: IUserWriteRepository,
		@inject("DTOService") private readonly dtoService: DTOService,
		@inject("EmailService") private readonly emailService: EmailService,
	) {}
	// Trying and keeping the logic from my current userservice method, see how it goes

	async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
		try {
			const emailVerificationToken = this.generateVerificationToken();
			const emailVerificationExpires = this.getVerificationExpiry();

			const user = await this.userWriteRepository.create({
				username: command.username,
				email: command.email,
				password: command.password,
				avatar: command.avatar || "",
				cover: command.cover || "",
				isEmailVerified: false,
				emailVerificationToken,
				emailVerificationExpires,
			});

			await this.emailService.sendEmailVerification(user.email, emailVerificationToken);

			const token = this.generateToken(user);
			const userDTO = this.dtoService.toAuthenticatedUserDTO(user);
			return { user: userDTO, token };
		} catch (error) {
			if (error instanceof Error) {
				throw createError(error.name, error.message);
			}
			throw createError("UnknownError", "An unknown error occurred");
		}
	}

	private generateVerificationToken(): string {
		const value = crypto.randomInt(0, 100000);
		return value.toString().padStart(5, "0");
	}

	private getVerificationExpiry(): Date {
		const ttlMinutes = Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES) || 60;
		return new Date(Date.now() + ttlMinutes * 60 * 1000);
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
