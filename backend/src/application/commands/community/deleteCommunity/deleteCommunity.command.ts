import { ICommand } from "@/application/common/interfaces/command.interface";

export class DeleteCommunityCommand implements ICommand {
	readonly type = "DeleteCommunityCommand";

	constructor(
		public readonly communityId: string,
		public readonly userId: string // Must be admin
	) {}
}
