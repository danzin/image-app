import { ICommand } from "@/application/common/interfaces/command.interface";

export class UpdateCommunityCommand implements ICommand {
	readonly type = "UpdateCommunityCommand";

	constructor(
		public readonly communityId: string,
		public readonly userId: string, // the user requesting the update (must be admin)
		public readonly updates: {
			name?: string;
			description?: string;
			avatarPath?: string;
			coverPhotoPath?: string;
		},
	) {}
}
