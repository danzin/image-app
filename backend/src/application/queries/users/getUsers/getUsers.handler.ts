import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetUsersQuery } from "./getUsers.query";
import { IUserReadRepository } from "../../../../repositories/interfaces/IUserReadRepository";
import { DTOService, PublicUserDTO } from "../../../../services/dto.service";
import { PaginationResult } from "../../../../types";

@injectable()
export class GetUsersQueryHandler implements IQueryHandler<GetUsersQuery, PaginationResult<PublicUserDTO>> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(query: GetUsersQuery): Promise<PaginationResult<PublicUserDTO>> {
		const result = await this.userReadRepository.findWithPagination(query.options);

		return {
			data: result.data.map((user) => this.dtoService.toPublicDTO(user)),
			total: result.total,
			page: result.page,
			limit: result.limit,
			totalPages: result.totalPages,
		};
	}
}
