import { ICommand } from "../../../common/interfaces/command.interface";

export class DeleteCommentCommand implements ICommand {
	readonly type = "DeleteCommentCommand";

	constructor(public readonly commentId: string, public readonly userPublicId: string) {}
}
