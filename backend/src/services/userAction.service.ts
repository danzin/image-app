import { inject, injectable } from "tsyringe";
import { UserActionRepository } from "../repositories/userAction.repository";
import { logger } from "../utils/winston";

@injectable()
export class UserActionService {
	constructor(@inject("UserActionRepository") private readonly userActionRepository: UserActionRepository) {}

	async logUserAction(userId: string, actionType: string, targetId: string): Promise<void> {
		try {
			await this.userActionRepository.logAction(userId, actionType, targetId);
		} catch (error) {
			logger.error("Error logging user action:", { error });
			// Don't throw, as logging failure shouldn't break the request
		}
	}
}
