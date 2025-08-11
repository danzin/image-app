import { injectable } from "tsyringe";
import { AdminUserDTO, PublicUserDTO } from "../types";
import { IUser } from "../types";

injectable();
export class UserDTOService {
	toPublicDTO(user: IUser): PublicUserDTO {
		return {
			id: String(user._id),
			username: user.username,
			avatar: user.avatar,
			cover: user.cover,
			images: user.images,
			followers: user.followers,
			following: user.following,
			createdAt: user.createdAt,
			bio: user.bio,
		};
	}

	toAdminDTO(user: IUser): AdminUserDTO {
		return {
			...this.toPublicDTO(user),
			email: user.email,
			isAdmin: user.isAdmin,
			isBanned: user.isBanned,
			bannedAt: user.bannedAt,
			bannedReason: user.bannedReason,
			bannedBy: user.bannedBy as string,
			updatedAt: user.updatedAt,
		};
	}
}
