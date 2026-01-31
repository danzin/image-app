import { ICommand } from "@/application/common/interfaces/command.interface";

export class DeletePostCommand implements ICommand {
	readonly type = "DeletePostCommand";

	constructor(
		public readonly postPublicId: string,
		public readonly requesterPublicId: string
	) {}
}
