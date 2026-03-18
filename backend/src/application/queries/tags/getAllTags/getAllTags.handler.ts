import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetAllTagsQuery } from "./getAllTags.query";
import { TagRepository } from "@/repositories/tag.repository";
import { ITag } from "@/types";
import { TOKENS } from "@/types/tokens";

@injectable()
export class GetAllTagsQueryHandler implements IQueryHandler<GetAllTagsQuery, ITag[]> {
	constructor(@inject(TOKENS.Repositories.Tag) private readonly tagRepository: TagRepository) {}

	async execute(_query: GetAllTagsQuery): Promise<ITag[]> {
		return (await this.tagRepository.getAll()) ?? [];
	}
}
