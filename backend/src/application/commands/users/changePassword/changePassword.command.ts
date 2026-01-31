import { ICommand } from "@/application/common/interfaces/command.interface";

export class ChangePasswordCommand implements ICommand {
	readonly type = "ChangePasswordCommand";

	constructor(
		public readonly userPublicId: string,
		public readonly currentPassword: string,
		public readonly newPassword: string
	) {}
}
