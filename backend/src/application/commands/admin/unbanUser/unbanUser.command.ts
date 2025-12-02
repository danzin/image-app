import { ICommand } from "../../../common/interfaces/command.interface";

export class UnbanUserCommand implements ICommand {
	readonly type = "UnbanUserCommand";

	constructor(public readonly userPublicId: string) {}
}
