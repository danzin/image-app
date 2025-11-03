import { ICommand } from "../../../common/interfaces/command.interface";

export class RecordPostViewCommand implements ICommand {
	readonly type = "RecordPostViewCommand";

	constructor(
		public readonly postPublicId: string,
		public readonly userPublicId: string // only authenticated users
	) {}
}
