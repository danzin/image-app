import { ICommand } from "@/application/common/interfaces/command.interface";

export class ResetPasswordCommand implements ICommand {
	readonly type = "ResetPasswordCommand";

	constructor(
		public readonly token: string,
		public readonly newPassword: string
	) {}
}
