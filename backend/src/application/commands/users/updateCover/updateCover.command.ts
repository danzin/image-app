import { ICommand } from "../../../common/interfaces/command.interface";

export class UpdateCoverCommand implements ICommand {
	readonly type = "UpdateCoverCommand";

	constructor(
		public readonly userPublicId: string,
		public readonly fileBuffer: Buffer
	) {}
}
