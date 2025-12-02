import { inject, injectable } from "tsyringe";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { PromoteToAdminCommand } from "./promoteToAdmin.command";
import { IUserReadRepository } from "../../../../repositories/interfaces/IUserReadRepository";
import { IUserWriteRepository } from "../../../../repositories/interfaces/IUserWriteRepository";
import { DTOService, AdminUserDTO } from "../../../../services/dto.service";
import { createError } from "../../../../utils/errors";

@injectable()
export class PromoteToAdminCommandHandler implements ICommandHandler<PromoteToAdminCommand, AdminUserDTO> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("UserWriteRepository") private readonly userWriteRepository: IUserWriteRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(command: PromoteToAdminCommand): Promise<AdminUserDTO> {
		const user = await this.userReadRepository.findByPublicId(command.userPublicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		if (user.isAdmin) {
			throw createError("ValidationError", "User is already an admin");
		}

		const updatedUser = await this.userWriteRepository.update(user.id, { isAdmin: true });
		if (!updatedUser) {
			throw createError("InternalServerError", "Failed to update user during promotion");
		}

		return this.dtoService.toAdminDTO(updatedUser);
	}
}
