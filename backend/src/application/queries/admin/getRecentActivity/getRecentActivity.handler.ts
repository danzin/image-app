import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetRecentActivityQuery } from "./getRecentActivity.query";
import { UserActionRepository } from "../../../../repositories/userAction.repository";
import { PaginationResult } from "../../../../types";

export interface ActivityItem {
	userId: string;
	username: string;
	action: string;
	targetType: string;
	targetId: string;
	timestamp: Date;
}

@injectable()
export class GetRecentActivityQueryHandler
	implements IQueryHandler<GetRecentActivityQuery, PaginationResult<ActivityItem>>
{
	constructor(@inject("UserActionRepository") private readonly userActionRepository: UserActionRepository) {}

	async execute(query: GetRecentActivityQuery): Promise<PaginationResult<ActivityItem>> {
		const activities = await this.userActionRepository.findWithPagination({
			...query.options,
			sortBy: "timestamp",
			sortOrder: "desc",
		});

		const transformedData = activities.data.map((activity: any) => ({
			userId: activity.userId?._id?.toString() || activity.userId?.toString() || "",
			username: activity.userId?.username || "Unknown",
			action: activity.actionType || "unknown",
			targetType: this.getTargetType(activity.actionType),
			targetId: activity.targetId?.toString() || "",
			timestamp: activity.timestamp || new Date(),
		}));

		return {
			data: transformedData,
			total: activities.total,
			page: activities.page,
			limit: activities.limit,
			totalPages: activities.totalPages,
		};
	}

	private getTargetType(actionType: string): string {
		const actionMap: Record<string, string> = {
			upload: "image",
			like: "image",
			comment: "image",
			follow: "user",
			unfollow: "user",
			favorite: "image",
			unfavorite: "image",
		};
		return actionMap[actionType] || "unknown";
	}
}
