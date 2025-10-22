import { ICommand } from "application/common/interfaces/command.interface";

export class LikeActionCommand implements ICommand {
	readonly type = "LikeActionCommand";

	constructor(
		public readonly userId: string,
		public readonly postId: string
	) {}
}
