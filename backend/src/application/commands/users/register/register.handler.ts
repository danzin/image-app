import { inject, injectable } from "tsyringe";
import { RegisterUserCommand } from "./register.command";
import { IUserWriteRepository } from "@/repositories/interfaces/IUserWriteRepository";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { createError } from "@/utils/errors";
import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { DTOService, AuthenticatedUserDTO } from "@/services/dto.service";
import { EmailService } from "@/services/email.service";
import { BloomFilterService } from "@/services/bloom-filter.service";
import { USERNAME_BLOOM_KEY, USERNAME_BLOOM_OPTIONS } from "@/config/bloomConfig";
import { logger } from "@/utils/winston";
import crypto from "crypto";

export interface RegisterUserResult {
	user: AuthenticatedUserDTO;
}

@injectable()
export class RegisterUserCommandHandler implements ICommandHandler<RegisterUserCommand, RegisterUserResult> {
	constructor(
		@inject("UserWriteRepository") private readonly userWriteRepository: IUserWriteRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("DTOService") private readonly dtoService: DTOService,
		@inject("EmailService") private readonly emailService: EmailService,
		@inject("BloomFilterService") private readonly bloomFilterService: BloomFilterService,
	) {}
	// Trying and keeping the logic from my current userservice method, see how it goes

	async execute(command: RegisterUserCommand): Promise<RegisterUserResult> {
		try {
			const emailVerificationToken = this.generateVerificationToken();
			const emailVerificationExpires = this.getVerificationExpiry();
			const usernameTrimmed = command.username.trim();
			const usernameMayExist = await this.usernameMayExist(usernameTrimmed);
			if (usernameMayExist) {
				const existingUser = await this.userReadRepository.findByUsername(usernameTrimmed);
				if (existingUser) {
					throw createError("ValidationError", "Username is already taken");
				}
			}

			const handleTrimmed = command.handle.trim();
			const user = await this.userWriteRepository.create({
				handle: handleTrimmed,
				handleNormalized: handleTrimmed.toLowerCase(),
				username: usernameTrimmed,
				email: command.email,
				password: command.password,
				avatar: command.avatar || "",
				cover: command.cover || "",
				registrationIp: command.ip,
				lastIp: command.ip,
				lastActive: new Date(),
				isEmailVerified: false,
				emailVerificationToken,
				emailVerificationExpires,
			});

			await this.emailService.sendEmailVerification(user.email, emailVerificationToken);
			await this.seedUsernameBloom(usernameTrimmed);

			const userDTO = this.dtoService.toAuthenticatedUserDTO(user);
			return { user: userDTO };
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

	private async usernameMayExist(username: string): Promise<boolean> {
		try {
			return await this.bloomFilterService.mightContain(USERNAME_BLOOM_KEY, username, USERNAME_BLOOM_OPTIONS);
		} catch (error) {
			logger.warn("[Bloom][username] availability pre-check failed; falling back to DB path", {
				username,
				error: error instanceof Error ? error.message : String(error),
			});
			return true;
		}
	}

	private async seedUsernameBloom(username: string): Promise<void> {
		try {
			await this.bloomFilterService.add(USERNAME_BLOOM_KEY, username, USERNAME_BLOOM_OPTIONS);
		} catch (error) {
			logger.warn("[Bloom][username] failed to seed bloom filter after registration", {
				username,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}
