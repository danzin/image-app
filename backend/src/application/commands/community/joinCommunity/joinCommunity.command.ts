import { ICommand } from "@/application/common/interfaces/command.interface";

export class JoinCommunityCommand implements ICommand {
	readonly type = "JoinCommunityCommand";

	constructor(
		public readonly communityId: string,
		public readonly userId: string
	) {}
}
