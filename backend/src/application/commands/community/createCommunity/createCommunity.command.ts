import { ICommand } from "../../../common/interfaces/command.interface";

export class CreateCommunityCommand implements ICommand {
	readonly type = "CreateCommunityCommand";

	constructor(
		public readonly name: string,
		public readonly description: string,
		public readonly creatorId: string,
		public readonly avatarPath?: string
	) {}
}
