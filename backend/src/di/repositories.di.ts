import { container } from "tsyringe";

import { UnitOfWork } from "../database/UnitOfWork";
import { UserRepository } from "../repositories/user.repository";
import { ImageRepository } from "../repositories/image.repository";
import { PostRepository } from "../repositories/post.repository";
import { PostLikeRepository } from "../repositories/postLike.repository";
import { PostViewRepository } from "../repositories/postView.repository";
import { CommentRepository } from "../repositories/comment.repository";
import { CommentLikeRepository } from "../repositories/commentLike.repository";
import { UserActionRepository } from "../repositories/userAction.repository";
import { TagRepository } from "../repositories/tag.repository";
import { FollowRepository } from "../repositories/follow.repository";
import { NotificationRepository } from "../repositories/notification.respository";
import { UserPreferenceRepository } from "../repositories/userPreference.repository";
import { FavoriteRepository } from "../repositories/favorite.repository";
import { ConversationRepository } from "../repositories/conversation.repository";
import { MessageRepository } from "../repositories/message.repository";
import { PostReadRepository } from "../repositories/read/PostReadRepository";
import { UserReadRepository } from "../repositories/read/UserReadRepository";
import { PostWriteRepository } from "../repositories/write/PostWriteRepository";
import { UserWriteRepository } from "../repositories/write/UserWriteRepository";
import { CommunityRepository } from "../repositories/community.repository";
import { CommunityMemberRepository } from "../repositories/communityMember.repository";

export function registerRepositories(): void {
	container.registerSingleton("UnitOfWork", UnitOfWork);
	container.registerSingleton("UserRepository", UserRepository);
	container.registerSingleton("ImageRepository", ImageRepository);
	container.registerSingleton("PostRepository", PostRepository);
	container.registerSingleton("PostLikeRepository", PostLikeRepository);
	container.registerSingleton("PostViewRepository", PostViewRepository);
	container.registerSingleton("CommentRepository", CommentRepository);
	container.registerSingleton("CommentLikeRepository", CommentLikeRepository);
	container.registerSingleton("UserActionRepository", UserActionRepository);
	container.registerSingleton("TagRepository", TagRepository);
	container.registerSingleton("FollowRepository", FollowRepository);
	container.registerSingleton("NotificationRepository", NotificationRepository);
	container.registerSingleton("UserPreferenceRepository", UserPreferenceRepository);
	container.registerSingleton("FavoriteRepository", FavoriteRepository);
	container.registerSingleton("ConversationRepository", ConversationRepository);
	container.registerSingleton("MessageRepository", MessageRepository);
	container.registerSingleton("CommunityRepository", CommunityRepository);
	container.registerSingleton("CommunityMemberRepository", CommunityMemberRepository);

	container.registerSingleton("PostReadRepository", PostReadRepository);
	container.registerSingleton("UserReadRepository", UserReadRepository);
	container.registerSingleton("PostWriteRepository", PostWriteRepository);
	container.registerSingleton("UserWriteRepository", UserWriteRepository);
}
