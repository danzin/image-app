import { injectable } from "tsyringe";
import { AdminUserDTO, PublicUserDTO } from "../types";
import { IUser } from "../types";

injectable()
export class UserDTOService {
  toPublicDTO(user: IUser): PublicUserDTO {
    return {
      id: user._id.toString(),
      username: user.username,
      avatar: user.avatar,
      cover: user.cover,
      images: user.images,
      followers: user.followers,
      following: user.following
    };
  }

  toAdminDTO(user: IUser): AdminUserDTO {
    return {
      ...this.toPublicDTO(user),
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}
