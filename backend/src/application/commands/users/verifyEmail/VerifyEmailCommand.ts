import { ICommand } from "@/application/common/interfaces/command.interface";

export class VerifyEmailCommand implements ICommand {
	readonly type = "VerifyEmailCommand";

	constructor(
		public readonly email: string,
		public readonly token: string,
	) {}
}
