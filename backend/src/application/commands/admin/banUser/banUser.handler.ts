import { inject, injectable } from "tsyringe";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { BanUserCommand } from "./banUser.command";
import { IUserReadRepository } from "../../../../repositories/interfaces/IUserReadRepository";
import { IUserWriteRepository } from "../../../../repositories/interfaces/IUserWriteRepository";
import { DTOService, AdminUserDTO } from "../../../../services/dto.service";
import { createError } from "../../../../utils/errors";

export interface BanUserResult {
	message: string;
	user: AdminUserDTO;
}

@injectable()
export class BanUserCommandHandler implements ICommandHandler<BanUserCommand, BanUserResult> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("UserWriteRepository") private readonly userWriteRepository: IUserWriteRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(command: BanUserCommand): Promise<BanUserResult> {
		const user = await this.userReadRepository.findByPublicId(command.userPublicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		const adminInternalId = await this.userReadRepository.findInternalIdByPublicId(command.adminPublicId);
		if (!adminInternalId) {
			throw createError("NotFoundError", "Admin not found");
		}

		const updatedUser = await this.userWriteRepository.update(user.id, {
			isBanned: true,
			bannedAt: new Date(),
			bannedReason: command.reason,
			bannedBy: adminInternalId,
		});

		if (!updatedUser) {
			throw createError("InternalServerError", "Failed to update user during ban");
		}

		return {
			message: "User banned successfully",
			user: this.dtoService.toAdminDTO(updatedUser),
		};
	}
}
