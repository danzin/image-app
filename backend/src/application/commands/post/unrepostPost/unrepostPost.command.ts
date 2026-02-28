import { ICommand } from "@/application/common/interfaces/command.interface";

export class UnrepostPostCommand implements ICommand {
	readonly type = "UnrepostPostCommand";

	constructor(
		public readonly userPublicId: string,
		public readonly targetPostPublicId: string,
	) {}
}
