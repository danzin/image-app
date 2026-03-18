import { inject, injectable } from "tsyringe";
import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { DemoteFromAdminCommand } from "./demoteFromAdmin.command";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { IUserWriteRepository } from "@/repositories/interfaces/IUserWriteRepository";
import { DTOService, AdminUserDTO } from "@/services/dto.service";
import { createError } from "@/utils/errors";
import { TOKENS } from "@/types/tokens";

@injectable()
export class DemoteFromAdminCommandHandler implements ICommandHandler<DemoteFromAdminCommand, AdminUserDTO> {
	constructor(
		@inject(TOKENS.Repositories.UserRead) private readonly userReadRepository: IUserReadRepository,
		@inject(TOKENS.Repositories.UserWrite) private readonly userWriteRepository: IUserWriteRepository,
		@inject(TOKENS.Services.DTO) private readonly dtoService: DTOService
	) {}

	async execute(command: DemoteFromAdminCommand): Promise<AdminUserDTO> {
		const user = await this.userReadRepository.findByPublicId(command.userPublicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		if (!user.isAdmin) {
			throw createError("ValidationError", "User is not an admin");
		}

		const updatedUser = await this.userWriteRepository.update(user.id, { isAdmin: false });
		if (!updatedUser) {
			throw createError("InternalServerError", "Failed to update user during demotion");
		}

		return this.dtoService.toAdminDTO(updatedUser);
	}
}
