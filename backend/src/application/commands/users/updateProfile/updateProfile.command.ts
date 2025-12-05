import { ICommand } from "../../../common/interfaces/command.interface";

export class UpdateProfileCommand implements ICommand {
	readonly type = "UpdateProfileCommand";

	constructor(
		public readonly userPublicId: string,
		public readonly updates: {
			username?: string;
			bio?: string;
		}
	) {}
}
