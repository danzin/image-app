import { ICommand } from "../../../common/interfaces/command.interface";

export class LikeActionByPublicIdCommand implements ICommand {
	readonly type = "LikeActionByPublicIdCommand";

	constructor(
		public readonly userPublicId: string,
		public readonly postPublicId: string
	) {}
}
