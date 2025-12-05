import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetAdminUserProfileQuery } from "./getAdminUserProfile.query";
import { IUserReadRepository } from "../../../../repositories/interfaces/IUserReadRepository";
import { DTOService, AdminUserDTO } from "../../../../services/dto.service";
import { createError } from "../../../../utils/errors";

@injectable()
export class GetAdminUserProfileQueryHandler implements IQueryHandler<GetAdminUserProfileQuery, AdminUserDTO> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(query: GetAdminUserProfileQuery): Promise<AdminUserDTO> {
		const user = await this.userReadRepository.findByPublicId(query.publicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		return this.dtoService.toAdminDTO(user);
	}
}
