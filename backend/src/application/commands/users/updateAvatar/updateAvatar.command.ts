import { ICommand } from "@/application/common/interfaces/command.interface";

export class UpdateAvatarCommand implements ICommand {
	readonly type = "UpdateAvatarCommand";

	constructor(
		public readonly userPublicId: string,
		public readonly filePath: string
	) {}
}
