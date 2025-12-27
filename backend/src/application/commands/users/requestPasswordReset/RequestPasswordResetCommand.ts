import { ICommand } from "../../../common/interfaces/command.interface";

export class RequestPasswordResetCommand implements ICommand {
	readonly type = "RequestPasswordResetCommand";

	constructor(public readonly email: string) {}
}
