import { ICommand } from "../../../common/interfaces/command.interface";

export class PromoteToAdminCommand implements ICommand {
	readonly type = "PromoteToAdminCommand";

	constructor(public readonly userPublicId: string) {}
}
