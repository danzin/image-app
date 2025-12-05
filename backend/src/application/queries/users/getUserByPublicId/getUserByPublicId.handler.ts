import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetUserByPublicIdQuery } from "./getUserByPublicId.query";
import { IUserReadRepository } from "../../../../repositories/interfaces/IUserReadRepository";
import { DTOService, PublicUserDTO } from "../../../../services/dto.service";
import { createError } from "../../../../utils/errors";

@injectable()
export class GetUserByPublicIdQueryHandler implements IQueryHandler<GetUserByPublicIdQuery, PublicUserDTO> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(query: GetUserByPublicIdQuery): Promise<PublicUserDTO> {
		const user = await this.userReadRepository.findByPublicId(query.publicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		return this.dtoService.toPublicDTO(user);
	}
}
