import { ICommand } from "../../../common/interfaces/command.interface";

export class KickMemberCommand implements ICommand {
	readonly type = "KickMemberCommand";

	constructor(
		public readonly communityId: string,
		public readonly adminId: string,
		public readonly targetUserId: string
	) {}
}
