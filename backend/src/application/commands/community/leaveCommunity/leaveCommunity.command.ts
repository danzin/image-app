import { ICommand } from "../../../common/interfaces/command.interface";

export class LeaveCommunityCommand implements ICommand {
	readonly type = "LeaveCommunityCommand";

	constructor(
		public readonly communityId: string,
		public readonly userId: string
	) {}
}
