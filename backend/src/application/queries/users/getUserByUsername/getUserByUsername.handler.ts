import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetUserByUsernameQuery } from "./getUserByUsername.query";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { DTOService, PublicUserDTO } from "@/services/dto.service";
import { createError } from "@/utils/errors";

@injectable()
export class GetUserByUsernameQueryHandler implements IQueryHandler<GetUserByUsernameQuery, PublicUserDTO> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("DTOService") private readonly dtoService: DTOService,
	) {}

	async execute(query: GetUserByUsernameQuery): Promise<PublicUserDTO> {
		const user = await this.userReadRepository.findByUsername(query.username);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		return this.dtoService.toPublicDTO(user);
	}
}
