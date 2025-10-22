import { ICommand } from "../../../common/interfaces/command.interface";

export class CreateCommentCommand implements ICommand {
	readonly type = "CreateCommentCommand";

	constructor(
		public readonly userPublicId: string,
		public readonly postPublicId: string,
		public readonly content: string
	) {}
}
