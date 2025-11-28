import { ICommand } from "../../../common/interfaces/command.interface";

export class CreatePostCommand implements ICommand {
	readonly type = "CreatePostCommand";

	constructor(
		public readonly userPublicId: string,
		public readonly body?: string,
		public readonly tags?: string[],
		public readonly imagePath?: string,
		public readonly imageOriginalName?: string
	) {}
}
