import { ICommand } from "../../../common/interfaces/command.interface";

export class LikeCommentCommand implements ICommand {
	readonly type = "LikeCommentCommand";

	constructor(
		public readonly userPublicId: string,
		public readonly commentId: string
	) {}
}
