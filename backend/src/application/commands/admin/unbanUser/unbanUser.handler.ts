import { inject, injectable } from "tsyringe";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { UnbanUserCommand } from "./unbanUser.command";
import { IUserReadRepository } from "../../../../repositories/interfaces/IUserReadRepository";
import { IUserWriteRepository } from "../../../../repositories/interfaces/IUserWriteRepository";
import { DTOService, AdminUserDTO } from "../../../../services/dto.service";
import { createError } from "../../../../utils/errors";

@injectable()
export class UnbanUserCommandHandler implements ICommandHandler<UnbanUserCommand, AdminUserDTO> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("UserWriteRepository") private readonly userWriteRepository: IUserWriteRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(command: UnbanUserCommand): Promise<AdminUserDTO> {
		const user = await this.userReadRepository.findByPublicId(command.userPublicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		const updatedUser = await this.userWriteRepository.update(user.id, {
			isBanned: false,
			bannedAt: null,
			bannedReason: null,
			bannedBy: null,
		});

		if (!updatedUser) {
			throw createError("InternalServerError", "Failed to update user during unban");
		}

		return this.dtoService.toAdminDTO(updatedUser);
	}
}
