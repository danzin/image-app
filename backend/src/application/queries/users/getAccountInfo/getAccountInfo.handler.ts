import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetAccountInfoQuery } from "./getAccountInfo.query";
import { inject, injectable } from "tsyringe";
import { IUserReadRepository } from "@/repositories/interfaces";
import { createError } from "@/utils/errors";
import { DTOService, AccountInfoDTO } from "@/services/dto.service";

export interface GetAccountInfoResult {
	accountInfo: AccountInfoDTO;
}

@injectable()
export class GetAccountInfoQueryHandler implements IQueryHandler<GetAccountInfoQuery, GetAccountInfoResult> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("DTOService") private readonly dtoService: DTOService,
	) {}

	async execute(query: GetAccountInfoQuery): Promise<GetAccountInfoResult> {
		const user = await this.userReadRepository.findByPublicId(query.userPublicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		return {
			accountInfo: this.dtoService.toAccountInfoDTO(user),
		};
	}
}
