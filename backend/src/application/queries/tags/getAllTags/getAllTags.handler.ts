import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetAllTagsQuery } from "./getAllTags.query";
import { TagRepository } from "@/repositories/tag.repository";
import { ITag } from "@/types";

@injectable()
export class GetAllTagsQueryHandler implements IQueryHandler<GetAllTagsQuery, ITag[]> {
	constructor(@inject("TagRepository") private readonly tagRepository: TagRepository) {}

	async execute(_query: GetAllTagsQuery): Promise<ITag[]> {
		return (await this.tagRepository.getAll()) ?? [];
	}
}
