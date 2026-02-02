import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetUserByHandleQuery } from "./getUserByUsername.query";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { DTOService, PublicUserDTO } from "@/services/dto.service";
import { createError } from "@/utils/errors";

@injectable()
export class GetUserByHandleQueryHandler implements IQueryHandler<GetUserByHandleQuery, PublicUserDTO> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("DTOService") private readonly dtoService: DTOService,
	) {}

	async execute(query: GetUserByHandleQuery): Promise<PublicUserDTO> {
		const user = await this.userReadRepository.findByHandle(query.handle);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		return this.dtoService.toPublicDTO(user);
	}
}
