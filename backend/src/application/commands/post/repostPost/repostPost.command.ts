import { ICommand } from "@/application/common/interfaces/command.interface";

export class RepostPostCommand implements ICommand {
	readonly type = "RepostPostCommand";

	constructor(
		public readonly userPublicId: string,
		public readonly targetPostPublicId: string,
		public readonly body?: string
	) {}
}
