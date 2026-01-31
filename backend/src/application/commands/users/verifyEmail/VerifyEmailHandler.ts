import { inject, injectable } from "tsyringe";
import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { VerifyEmailCommand } from "./VerifyEmailCommand";
import { createError } from "@/utils/errors";
import { IUserReadRepository, IUserWriteRepository } from "@/repositories/interfaces";
import { DTOService, AdminUserDTO, AuthenticatedUserDTO } from "@/services/dto.service";

export type VerifyEmailResult = AdminUserDTO | AuthenticatedUserDTO;

@injectable()
export class VerifyEmailHandler implements ICommandHandler<VerifyEmailCommand, VerifyEmailResult> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("UserWriteRepository") private readonly userWriteRepository: IUserWriteRepository,
		@inject("DTOService") private readonly dtoService: DTOService,
	) {}

	async execute(command: VerifyEmailCommand): Promise<VerifyEmailResult> {
		const user = await this.userReadRepository.findByEmailVerificationToken(command.email, command.token);
		if (!user) {
			throw createError("ValidationError", "Invalid or expired verification token");
		}

		if (user.isEmailVerified) {
			return user.isAdmin ? this.dtoService.toAdminDTO(user) : this.dtoService.toAuthenticatedUserDTO(user);
		}

		const updatedUser = await this.userWriteRepository.update(user.id, {
			$set: { isEmailVerified: true },
			$unset: { emailVerificationToken: 1, emailVerificationExpires: 1 },
		});

		if (!updatedUser) {
			throw createError("DatabaseError", "Failed to verify email");
		}

		return updatedUser.isAdmin
			? this.dtoService.toAdminDTO(updatedUser)
			: this.dtoService.toAuthenticatedUserDTO(updatedUser);
	}
}
