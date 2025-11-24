import { ICommand } from "../../../common/interfaces/command.interface";

export class FollowUserCommand implements ICommand {
	readonly type = "FollowUserCommand";
	constructor(
		public readonly followerPublicId: string,
		public readonly followeePublicId: string
	) {}
}
