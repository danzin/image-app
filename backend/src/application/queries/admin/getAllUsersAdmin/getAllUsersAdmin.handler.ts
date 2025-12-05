import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetAllUsersAdminQuery } from "./getAllUsersAdmin.query";
import { IUserReadRepository } from "../../../../repositories/interfaces/IUserReadRepository";
import { DTOService, AdminUserDTO } from "../../../../services/dto.service";
import { PaginationResult } from "../../../../types";

@injectable()
export class GetAllUsersAdminQueryHandler
	implements IQueryHandler<GetAllUsersAdminQuery, PaginationResult<AdminUserDTO>>
{
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(query: GetAllUsersAdminQuery): Promise<PaginationResult<AdminUserDTO>> {
		const result = await this.userReadRepository.findWithPagination(query.options);

		return {
			data: result.data.map((user) => this.dtoService.toAdminDTO(user)),
			total: result.total,
			page: result.page,
			limit: result.limit,
			totalPages: result.totalPages,
		};
	}
}
