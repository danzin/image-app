import { ICommand } from "@/application/common/interfaces/command.interface";

export class RegisterUserCommand implements ICommand {
	readonly type = "RegisterUserCommand";

	constructor(
		public readonly username: string,
		public readonly email: string,
		public readonly password: string,
		public readonly avatar?: string,
		public readonly cover?: string,
	) {}
}
