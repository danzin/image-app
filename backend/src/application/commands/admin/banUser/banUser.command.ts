import { ICommand } from "../../../common/interfaces/command.interface";

export class BanUserCommand implements ICommand {
	readonly type = "BanUserCommand";

	constructor(
		public readonly userPublicId: string,
		public readonly adminPublicId: string,
		public readonly reason: string
	) {}
}
