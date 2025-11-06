import { ICommand } from "../../../common/interfaces/command.interface";

export class DeleteUserCommand implements ICommand {
	readonly type = "DeleteUserCommand";

	constructor(public readonly userPublicId: string) {}
}
