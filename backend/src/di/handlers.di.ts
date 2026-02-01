import { container } from "tsyringe";

import { CommandBus } from "@/application/common/buses/command.bus";
import { QueryBus } from "@/application/common/buses/query.bus";
import { EventBus } from "@/application/common/buses/event.bus";
import { FollowUserCommand } from "@/application/commands/users/followUser/followUser.command";
import { FollowUserCommandHandler } from "@/application/commands/users/followUser/followUser.handler";
import { RegisterUserCommandHandler } from "@/application/commands/users/register/register.handler";
import { RegisterUserCommand } from "@/application/commands/users/register/register.command";
import { GetDashboardStatsQuery } from "@/application/queries/admin/getDashboardStats/getDashboardStats.query";
import { GetDashboardStatsQueryHandler } from "@/application/queries/admin/getDashboardStats/getDashboardStats.handler";
import { GetMeQueryHandler } from "@/application/queries/users/getMe/getMe.handler";
import { GetMeQuery } from "@/application/queries/users/getMe/getMe.query";
import { GetWhoToFollowQueryHandler } from "@/application/queries/users/getWhoToFollow/getWhoToFollow.handler";
import { GetWhoToFollowQuery } from "@/application/queries/users/getWhoToFollow/getWhoToFollow.query";
import { GetTrendingTagsQueryHandler } from "@/application/queries/tags/getTrendingTags/getTrendingTags.handler";
import { GetTrendingTagsQuery } from "@/application/queries/tags/getTrendingTags/getTrendingTags.query";
import { FeedInteractionHandler } from "@/application/events/user/feed-interaction.handler";
import { UserInteractedWithPostEvent } from "@/application/events/user/user-interaction.event";
import { PostDeletedEvent, PostUploadedEvent } from "@/application/events/post/post.event";
import { LikeActionCommand } from "@/application/commands/users/likeAction/likeAction.command";
import { LikeActionCommandHandler } from "@/application/commands/users/likeAction/likeAction.handler";
import { LikeActionByPublicIdCommand } from "@/application/commands/users/likeActionByPublicId/likeActionByPublicId.command";
import { LikeActionByPublicIdCommandHandler } from "@/application/commands/users/likeActionByPublicId/likeActionByPublicId.handler";
import { PostUploadHandler } from "@/application/events/post/post-uploaded.handler";
import { PostDeleteHandler } from "@/application/events/post/post-deleted.handler";
import { UserAvatarChangedEvent, UserUsernameChangedEvent } from "@/application/events/user/user-interaction.event";
import { UserAvatarChangedHandler } from "@/application/events/user/user-avatar-change.handler";
import { UserUsernameChangedHandler } from "@/application/events/user/user-username-change.handler";
import { CreateCommentCommand } from "@/application/commands/comments/createComment/createComment.command";
import { CreateCommentCommandHandler } from "@/application/commands/comments/createComment/create-comment.handler";
import { DeleteCommentCommand } from "@/application/commands/comments/deleteComment/deleteComment.command";
import { DeleteCommentCommandHandler } from "@/application/commands/comments/createComment/delete-comment.handler";
import { LikeCommentCommand } from "@/application/commands/comments/likeComment/likeComment.command";
import { LikeCommentCommandHandler } from "@/application/commands/comments/likeComment/like-comment.handler";
import { MessageSentHandler } from "@/application/events/message/message-sent.handler";
import { MessageSentEvent } from "@/application/events/message/message.event";
import { NotificationRequestedEvent } from "@/application/events/notification/notification.event";
import { NotificationRequestedHandler } from "@/application/events/notification/notification-requested.handler";
import { CreatePostCommand } from "@/application/commands/post/createPost/createPost.command";
import { CreatePostCommandHandler } from "@/application/commands/post/createPost/createPost.handler";
import { DeletePostCommand } from "@/application/commands/post/deletePost/deletePost.command";
import { DeletePostCommandHandler } from "@/application/commands/post/deletePost/deletePost.handler";
import { RepostPostCommand } from "@/application/commands/post/repostPost/repostPost.command";
import { RepostPostCommandHandler } from "@/application/commands/post/repostPost/repostPost.handler";
import { RecordPostViewCommand } from "@/application/commands/post/recordPostView/recordPostView.command";
import { RecordPostViewCommandHandler } from "@/application/commands/post/recordPostView/recordPostView.handler";
import { GetPersonalizedFeedQuery } from "@/application/queries/feed/getPersonalizedFeed/getPersonalizedFeed.query";
import { GetPersonalizedFeedQueryHandler } from "@/application/queries/feed/getPersonalizedFeed/getPersonalizedFeed.handler";
import { GetPostByPublicIdQuery } from "@/application/queries/post/getPostByPublicId/getPostByPublicId.query";
import { GetPostByPublicIdQueryHandler } from "@/application/queries/post/getPostByPublicId/getPostByPublicId.handler";
import { GetPostBySlugQuery } from "@/application/queries/post/getPostBySlug/getPostBySlug.query";
import { GetPostBySlugQueryHandler } from "@/application/queries/post/getPostBySlug/getPostBySlug.handler";
import { GetPostsQuery } from "@/application/queries/post/getPosts/getPosts.query";
import { GetPostsQueryHandler } from "@/application/queries/post/getPosts/getPosts.handler";
import { GetAllPostsAdminQuery } from "@/application/queries/post/getAllPostsAdmin/getAllPostsAdmin.query";
import { GetAllPostsAdminQueryHandler } from "@/application/queries/post/getAllPostsAdmin/getAllPostsAdmin.handler";
import { GetPostsByUserQuery } from "@/application/queries/post/getPostsByUser/getPostsByUser.query";
import { GetPostsByUserQueryHandler } from "@/application/queries/post/getPostsByUser/getPostsByUser.handler";
import { SearchPostsByTagsQuery } from "@/application/queries/post/searchPostsByTags/searchPostsByTags.query";
import { SearchPostsByTagsQueryHandler } from "@/application/queries/post/searchPostsByTags/searchPostsByTags.handler";
import { GetAllTagsQuery } from "@/application/queries/tags/getAllTags/getAllTags.query";
import { GetAllTagsQueryHandler } from "@/application/queries/tags/getAllTags/getAllTags.handler";
import { GetLikedPostsByUserQuery } from "@/application/queries/post/getLikedPostsByUser/getLikedPostsByUser.query";
import { GetLikedPostsByUserHandler } from "@/application/queries/post/getLikedPostsByUser/getLikedPostsByUser.handler";
import { NewPostMessageHandler } from "@/application/handlers/realtime/NewPostMessageHandler";
import { GlobalNewPostMessageHandler } from "@/application/handlers/realtime/GlobalNewPostMessageHandler";
import { PostDeletedMessageHandler } from "@/application/handlers/realtime/PostDeletedMessageHandler";
import { InteractionMessageHandler } from "@/application/handlers/realtime/InteractionMessageHandler";
import { LikeUpdateMessageHandler } from "@/application/handlers/realtime/LikeUpdateMessageHandler";
import { AvatarUpdateMessageHandler } from "@/application/handlers/realtime/AvatarUpdateMessageHandler";
import { MessageSentHandler as RealtimeMessageSentHandler } from "@/application/handlers/realtime/MessageSentHandler";
import { GetForYouFeedQueryHandler } from "@/application/queries/feed/getForYouFeed/getForYouFeed.handler";
import { GetForYouFeedQuery } from "@/application/queries/feed/getForYouFeed/getForYouFeed.query";
import { GetTrendingFeedQueryHandler } from "@/application/queries/feed/getTrendingFeed/getTrendingFeed.handler";
import { GetTrendingFeedQuery } from "@/application/queries/feed/getTrendingFeed/getTrendingFeed.query";
import { DeleteUserCommand } from "@/application/commands/users/deleteUser/deleteUser.command";
import { DeleteUserCommandHandler } from "@/application/commands/users/deleteUser/deleteUser.handler";
import { UpdateAvatarCommand } from "@/application/commands/users/updateAvatar/updateAvatar.command";
import { UpdateAvatarCommandHandler } from "@/application/commands/users/updateAvatar/updateAvatar.handler";
import { UpdateCoverCommand } from "@/application/commands/users/updateCover/updateCover.command";
import { UpdateCoverCommandHandler } from "@/application/commands/users/updateCover/updateCover.handler";
import { UserCoverChangedEvent, UserDeletedEvent } from "@/application/events/user/user-interaction.event";
import { UserCoverChangedHandler } from "@/application/events/user/user-cover-change.handler";
import { UserDeletedHandler } from "@/application/events/user/user-deleted.handler";
import { GetUserByPublicIdQuery } from "@/application/queries/users/getUserByPublicId/getUserByPublicId.query";
import { GetUserByPublicIdQueryHandler } from "@/application/queries/users/getUserByPublicId/getUserByPublicId.handler";
import { GetUserByUsernameQuery } from "@/application/queries/users/getUserByUsername/getUserByUsername.query";
import { GetUserByUsernameQueryHandler } from "@/application/queries/users/getUserByUsername/getUserByUsername.handler";
import { GetUsersQuery } from "@/application/queries/users/getUsers/getUsers.query";
import { GetUsersQueryHandler } from "@/application/queries/users/getUsers/getUsers.handler";
import { CheckFollowStatusQuery } from "@/application/queries/users/checkFollowStatus/checkFollowStatus.query";
import { CheckFollowStatusQueryHandler } from "@/application/queries/users/checkFollowStatus/checkFollowStatus.handler";
import { GetFollowersQuery } from "@/application/queries/users/getFollowers/getFollowers.query";
import { GetFollowersQueryHandler } from "@/application/queries/users/getFollowers/getFollowers.handler";
import { GetFollowingQuery } from "@/application/queries/users/getFollowing/getFollowing.query";
import { GetFollowingQueryHandler } from "@/application/queries/users/getFollowing/getFollowing.handler";
import { UpdateProfileCommand } from "@/application/commands/users/updateProfile/updateProfile.command";
import { UpdateProfileCommandHandler } from "@/application/commands/users/updateProfile/updateProfile.handler";
import { ChangePasswordCommand } from "@/application/commands/users/changePassword/changePassword.command";
import { ChangePasswordCommandHandler } from "@/application/commands/users/changePassword/changePassword.handler";
import { GetAllUsersAdminQuery } from "@/application/queries/admin/getAllUsersAdmin/getAllUsersAdmin.query";
import { GetAllUsersAdminQueryHandler } from "@/application/queries/admin/getAllUsersAdmin/getAllUsersAdmin.handler";
import { GetAdminUserProfileQuery } from "@/application/queries/admin/getAdminUserProfile/getAdminUserProfile.query";
import { GetAdminUserProfileQueryHandler } from "@/application/queries/admin/getAdminUserProfile/getAdminUserProfile.handler";
import { GetUserStatsQuery } from "@/application/queries/admin/getUserStats/getUserStats.query";
import { GetUserStatsQueryHandler } from "@/application/queries/admin/getUserStats/getUserStats.handler";
import { GetRecentActivityQuery } from "@/application/queries/admin/getRecentActivity/getRecentActivity.query";
import { GetRecentActivityQueryHandler } from "@/application/queries/admin/getRecentActivity/getRecentActivity.handler";
import { BanUserCommand } from "@/application/commands/admin/banUser/banUser.command";
import { BanUserCommandHandler } from "@/application/commands/admin/banUser/banUser.handler";
import { UnbanUserCommand } from "@/application/commands/admin/unbanUser/unbanUser.command";
import { UnbanUserCommandHandler } from "@/application/commands/admin/unbanUser/unbanUser.handler";
import { PromoteToAdminCommand } from "@/application/commands/admin/promoteToAdmin/promoteToAdmin.command";
import { PromoteToAdminCommandHandler } from "@/application/commands/admin/promoteToAdmin/promoteToAdmin.handler";
import { DemoteFromAdminCommand } from "@/application/commands/admin/demoteFromAdmin/demoteFromAdmin.command";
import { DemoteFromAdminCommandHandler } from "@/application/commands/admin/demoteFromAdmin/demoteFromAdmin.handler";
import { RequestPasswordResetHandler } from "@/application/commands/users/requestPasswordReset/RequestPasswordResetHandler";
import { RequestPasswordResetCommand } from "@/application/commands/users/requestPasswordReset/RequestPasswordResetCommand";
import { ResetPasswordHandler } from "@/application/commands/users/resetPassword/ResetPasswordHandler";
import { ResetPasswordCommand } from "@/application/commands/users/resetPassword/ResetPasswordCommand";
import { VerifyEmailHandler } from "@/application/commands/users/verifyEmail/VerifyEmailHandler";
import { VerifyEmailCommand } from "@/application/commands/users/verifyEmail/VerifyEmailCommand";
import { CreateCommunityCommand } from "@/application/commands/community/createCommunity/createCommunity.command";
import { CreateCommunityCommandHandler } from "@/application/commands/community/createCommunity/createCommunity.handler";
import { JoinCommunityCommand } from "@/application/commands/community/joinCommunity/joinCommunity.command";
import { JoinCommunityCommandHandler } from "@/application/commands/community/joinCommunity/joinCommunity.handler";
import { LeaveCommunityCommand } from "@/application/commands/community/leaveCommunity/leaveCommunity.command";
import { LeaveCommunityCommandHandler } from "@/application/commands/community/leaveCommunity/leaveCommunity.handler";
import { GetCommunityDetailsQuery } from "@/application/queries/community/getCommunityDetails/getCommunityDetails.query";
import { GetCommunityDetailsQueryHandler } from "@/application/queries/community/getCommunityDetails/getCommunityDetails.handler";
import { GetUserCommunitiesQuery } from "@/application/queries/community/getUserCommunities/getUserCommunities.query";
import { GetUserCommunitiesQueryHandler } from "@/application/queries/community/getUserCommunities/getUserCommunities.handler";
import { GetCommunityFeedQuery } from "@/application/queries/community/getCommunityFeed/getCommunityFeed.query";
import { GetCommunityFeedQueryHandler } from "@/application/queries/community/getCommunityFeed/getCommunityFeed.handler";
import { UpdateCommunityCommand } from "@/application/commands/community/updateCommunity/updateCommunity.command";
import { UpdateCommunityCommandHandler } from "@/application/commands/community/updateCommunity/updateCommunity.handler";
import { DeleteCommunityCommand } from "@/application/commands/community/deleteCommunity/deleteCommunity.command";
import { DeleteCommunityCommandHandler } from "@/application/commands/community/deleteCommunity/deleteCommunity.handler";
import { KickMemberCommand } from "@/application/commands/community/kickMember/kickMember.command";
import { KickMemberCommandHandler } from "@/application/commands/community/kickMember/kickMember.handler";
import { GetAllCommunitiesQuery } from "@/application/queries/community/getAllCommunities/getAllCommunities.query";
import { GetAllCommunitiesQueryHandler } from "@/application/queries/community/getAllCommunities/getAllCommunities.handler";
import { GetCommunityMembersQuery } from "@/application/queries/community/getCommunityMembers/getCommunityMembers.query";
import { GetCommunityMembersQueryHandler } from "@/application/queries/community/getCommunityMembers/getCommunityMembers.handler";
import { LogRequestCommand } from "@/application/commands/admin/logRequest/logRequest.command";
import { LogRequestCommandHandler } from "@/application/commands/admin/logRequest/logRequest.handler";
import { GetRequestLogsQuery } from "@/application/queries/admin/getRequestLogs/getRequestLogs.query";
import { GetRequestLogsQueryHandler } from "@/application/queries/admin/getRequestLogs/getRequestLogs.handler";

export function registerCQRS(): void {
	container.registerSingleton("CommandBus", CommandBus);
	container.registerSingleton("QueryBus", QueryBus);
	container.registerSingleton("EventBus", EventBus);

	container.register("RegisterUserCommandHandler", { useClass: RegisterUserCommandHandler });
	container.register("FollowUserCommandHandler", { useClass: FollowUserCommandHandler });
	container.register("DeleteUserCommandHandler", { useClass: DeleteUserCommandHandler });
	container.register("UpdateAvatarCommandHandler", { useClass: UpdateAvatarCommandHandler });
	container.register("UpdateCoverCommandHandler", { useClass: UpdateCoverCommandHandler });
	container.register("UpdateProfileCommandHandler", { useClass: UpdateProfileCommandHandler });
	container.register("ChangePasswordCommandHandler", { useClass: ChangePasswordCommandHandler });

	container.register("LikeActionCommandHandler", { useClass: LikeActionCommandHandler });
	container.register("LikeActionByPublicIdCommandHandler", { useClass: LikeActionByPublicIdCommandHandler });

	container.register("CreateCommentCommandHandler", { useClass: CreateCommentCommandHandler });
	container.register("DeleteCommentCommandHandler", { useClass: DeleteCommentCommandHandler });
	container.register("LikeCommentCommandHandler", { useClass: LikeCommentCommandHandler });
	container.register("CreatePostCommandHandler", { useClass: CreatePostCommandHandler });
	container.register("DeletePostCommandHandler", { useClass: DeletePostCommandHandler });
	container.register("RepostPostCommandHandler", { useClass: RepostPostCommandHandler });

	container.register("RecordPostViewCommandHandler", { useClass: RecordPostViewCommandHandler });
	container.register("GetLikedPostsByUserHandler", { useClass: GetLikedPostsByUserHandler });

	container.register("BanUserCommandHandler", { useClass: BanUserCommandHandler });
	container.register("UnbanUserCommandHandler", { useClass: UnbanUserCommandHandler });
	container.register("PromoteToAdminCommandHandler", { useClass: PromoteToAdminCommandHandler });
	container.register("DemoteFromAdminCommandHandler", { useClass: DemoteFromAdminCommandHandler });
	container.register("LogRequestCommandHandler", { useClass: LogRequestCommandHandler });

	container.register("PostUploadHandler", { useClass: PostUploadHandler });
	container.register("PostDeleteHandler", { useClass: PostDeleteHandler });
	container.register("UserAvatarChangedHandler", { useClass: UserAvatarChangedHandler });
	container.register("UserUsernameChangedHandler", { useClass: UserUsernameChangedHandler });
	container.register("UserCoverChangedHandler", { useClass: UserCoverChangedHandler });
	container.register("UserDeletedHandler", { useClass: UserDeletedHandler });
	container.register("RequestPasswordResetHandler", { useClass: RequestPasswordResetHandler });
	container.register("ResetPasswordHandler", { useClass: ResetPasswordHandler });
	container.register("VerifyEmailHandler", { useClass: VerifyEmailHandler });

	container.register("CreateCommunityCommandHandler", { useClass: CreateCommunityCommandHandler });
	container.register("JoinCommunityCommandHandler", { useClass: JoinCommunityCommandHandler });
	container.register("LeaveCommunityCommandHandler", { useClass: LeaveCommunityCommandHandler });
	container.register("GetCommunityDetailsQueryHandler", { useClass: GetCommunityDetailsQueryHandler });
	container.register("GetUserCommunitiesQueryHandler", { useClass: GetUserCommunitiesQueryHandler });
	container.register("GetCommunityFeedQueryHandler", { useClass: GetCommunityFeedQueryHandler });
	container.register("UpdateCommunityCommandHandler", { useClass: UpdateCommunityCommandHandler });
	container.register("DeleteCommunityCommandHandler", { useClass: DeleteCommunityCommandHandler });
	container.register("KickMemberCommandHandler", { useClass: KickMemberCommandHandler });
	container.register("GetAllCommunitiesQueryHandler", { useClass: GetAllCommunitiesQueryHandler });
	container.register("GetCommunityMembersQueryHandler", { useClass: GetCommunityMembersQueryHandler });

	container.register("GetMeQueryHandler", { useClass: GetMeQueryHandler });
	container.register("GetUserByPublicIdQueryHandler", { useClass: GetUserByPublicIdQueryHandler });
	container.register("GetUserByUsernameQueryHandler", { useClass: GetUserByUsernameQueryHandler });
	container.register("GetUsersQueryHandler", { useClass: GetUsersQueryHandler });
	container.register("CheckFollowStatusQueryHandler", { useClass: CheckFollowStatusQueryHandler });
	container.register("GetFollowersQueryHandler", { useClass: GetFollowersQueryHandler });
	container.register("GetFollowingQueryHandler", { useClass: GetFollowingQueryHandler });
	container.register("GetDashboardStatsQueryHandler", { useClass: GetDashboardStatsQueryHandler });
	container.register("GetWhoToFollowQueryHandler", { useClass: GetWhoToFollowQueryHandler });
	container.register("GetTrendingTagsQueryHandler", { useClass: GetTrendingTagsQueryHandler });
	container.register("GetPersonalizedFeedQueryHandler", { useClass: GetPersonalizedFeedQueryHandler });
	container.register("GetForYouFeedQueryHandler", { useClass: GetForYouFeedQueryHandler });
	container.register("GetTrendingFeedQueryHandler", { useClass: GetTrendingFeedQueryHandler });
	container.register("GetPostByPublicIdQueryHandler", { useClass: GetPostByPublicIdQueryHandler });
	container.register("GetPostBySlugQueryHandler", { useClass: GetPostBySlugQueryHandler });
	container.register("GetPostsQueryHandler", { useClass: GetPostsQueryHandler });
	container.register("GetPostsByUserQueryHandler", { useClass: GetPostsByUserQueryHandler });
	container.register("SearchPostsByTagsQueryHandler", { useClass: SearchPostsByTagsQueryHandler });
	container.register("GetAllTagsQueryHandler", { useClass: GetAllTagsQueryHandler });
	container.register("GetLikedPostsByUserHandler", { useClass: GetLikedPostsByUserHandler });

	container.register("GetAllPostsAdminQueryHandler", { useClass: GetAllPostsAdminQueryHandler });
	container.register("GetAllUsersAdminQueryHandler", { useClass: GetAllUsersAdminQueryHandler });
	container.register("GetAdminUserProfileQueryHandler", { useClass: GetAdminUserProfileQueryHandler });
	container.register("GetUserStatsQueryHandler", { useClass: GetUserStatsQueryHandler });
	container.register("GetRecentActivityQueryHandler", { useClass: GetRecentActivityQueryHandler });
	container.register("GetRequestLogsQueryHandler", { useClass: GetRequestLogsQueryHandler });

	container.register("FeedInteractionHandler", { useClass: FeedInteractionHandler });
	container.register("MessageSentHandler", { useClass: MessageSentHandler });
	container.register("NotificationRequestedHandler", { useClass: NotificationRequestedHandler });
}

export function initCQRS(): void {
	const commandBus = container.resolve<CommandBus>("CommandBus");
	const queryBus = container.resolve<QueryBus>("QueryBus");
	const eventBus = container.resolve<EventBus>("EventBus");

	commandBus.register(RegisterUserCommand, container.resolve<RegisterUserCommandHandler>("RegisterUserCommandHandler"));
	commandBus.register(FollowUserCommand, container.resolve<FollowUserCommandHandler>("FollowUserCommandHandler"));
	commandBus.register(DeleteUserCommand, container.resolve<DeleteUserCommandHandler>("DeleteUserCommandHandler"));
	commandBus.register(UpdateAvatarCommand, container.resolve<UpdateAvatarCommandHandler>("UpdateAvatarCommandHandler"));
	commandBus.register(UpdateCoverCommand, container.resolve<UpdateCoverCommandHandler>("UpdateCoverCommandHandler"));
	commandBus.register(LikeActionCommand, container.resolve<LikeActionCommandHandler>("LikeActionCommandHandler"));
	commandBus.register(
		LikeActionByPublicIdCommand,
		container.resolve<LikeActionByPublicIdCommandHandler>("LikeActionByPublicIdCommandHandler"),
	);
	commandBus.register(
		CreateCommentCommand,
		container.resolve<CreateCommentCommandHandler>("CreateCommentCommandHandler"),
	);
	commandBus.register(
		DeleteCommentCommand,
		container.resolve<DeleteCommentCommandHandler>("DeleteCommentCommandHandler"),
	);
	commandBus.register(LikeCommentCommand, container.resolve<LikeCommentCommandHandler>("LikeCommentCommandHandler"));
	commandBus.register(CreatePostCommand, container.resolve<CreatePostCommandHandler>("CreatePostCommandHandler"));
	commandBus.register(DeletePostCommand, container.resolve<DeletePostCommandHandler>("DeletePostCommandHandler"));
	commandBus.register(RepostPostCommand, container.resolve<RepostPostCommandHandler>("RepostPostCommandHandler"));
	commandBus.register(
		RecordPostViewCommand,
		container.resolve<RecordPostViewCommandHandler>("RecordPostViewCommandHandler"),
	);
	commandBus.register(
		UpdateProfileCommand,
		container.resolve<UpdateProfileCommandHandler>("UpdateProfileCommandHandler"),
	);
	commandBus.register(
		ChangePasswordCommand,
		container.resolve<ChangePasswordCommandHandler>("ChangePasswordCommandHandler"),
	);

	commandBus.register(
		RequestPasswordResetCommand,
		container.resolve<RequestPasswordResetHandler>("RequestPasswordResetHandler"),
	);

	commandBus.register(ResetPasswordCommand, container.resolve<ResetPasswordHandler>("ResetPasswordHandler"));
	commandBus.register(VerifyEmailCommand, container.resolve<VerifyEmailHandler>("VerifyEmailHandler"));

	commandBus.register(BanUserCommand, container.resolve<BanUserCommandHandler>("BanUserCommandHandler"));
	commandBus.register(UnbanUserCommand, container.resolve<UnbanUserCommandHandler>("UnbanUserCommandHandler"));
	commandBus.register(
		PromoteToAdminCommand,
		container.resolve<PromoteToAdminCommandHandler>("PromoteToAdminCommandHandler"),
	);
	commandBus.register(
		DemoteFromAdminCommand,
		container.resolve<DemoteFromAdminCommandHandler>("DemoteFromAdminCommandHandler"),
	);
	commandBus.register(LogRequestCommand, container.resolve<LogRequestCommandHandler>("LogRequestCommandHandler"));

	eventBus.subscribe(UserInteractedWithPostEvent, container.resolve<FeedInteractionHandler>("FeedInteractionHandler"));
	eventBus.subscribe(PostUploadedEvent, container.resolve<PostUploadHandler>("PostUploadHandler"));
	eventBus.subscribe(PostDeletedEvent, container.resolve<PostDeleteHandler>("PostDeleteHandler"));
	eventBus.subscribe(UserAvatarChangedEvent, container.resolve<UserAvatarChangedHandler>("UserAvatarChangedHandler"));
	eventBus.subscribe(
		UserUsernameChangedEvent,
		container.resolve<UserUsernameChangedHandler>("UserUsernameChangedHandler"),
	);
	eventBus.subscribe(UserCoverChangedEvent, container.resolve<UserCoverChangedHandler>("UserCoverChangedHandler"));
	eventBus.subscribe(UserDeletedEvent, container.resolve<UserDeletedHandler>("UserDeletedHandler"));
	eventBus.subscribe(MessageSentEvent, container.resolve<MessageSentHandler>("MessageSentHandler"));
	eventBus.subscribe(
		NotificationRequestedEvent,
		container.resolve<NotificationRequestedHandler>("NotificationRequestedHandler"),
	);

	queryBus.register(GetMeQuery, container.resolve<GetMeQueryHandler>("GetMeQueryHandler"));
	queryBus.register(
		GetDashboardStatsQuery,
		container.resolve<GetDashboardStatsQueryHandler>("GetDashboardStatsQueryHandler"),
	);
	queryBus.register(GetWhoToFollowQuery, container.resolve<GetWhoToFollowQueryHandler>("GetWhoToFollowQueryHandler"));
	queryBus.register(
		GetTrendingTagsQuery,
		container.resolve<GetTrendingTagsQueryHandler>("GetTrendingTagsQueryHandler"),
	);
	queryBus.register(
		GetPersonalizedFeedQuery,
		container.resolve<GetPersonalizedFeedQueryHandler>("GetPersonalizedFeedQueryHandler"),
	);
	queryBus.register(GetForYouFeedQuery, container.resolve<GetForYouFeedQueryHandler>("GetForYouFeedQueryHandler"));
	queryBus.register(
		GetTrendingFeedQuery,
		container.resolve<GetTrendingFeedQueryHandler>("GetTrendingFeedQueryHandler"),
	);
	queryBus.register(
		GetPostByPublicIdQuery,
		container.resolve<GetPostByPublicIdQueryHandler>("GetPostByPublicIdQueryHandler"),
	);
	queryBus.register(GetPostBySlugQuery, container.resolve<GetPostBySlugQueryHandler>("GetPostBySlugQueryHandler"));
	queryBus.register(GetPostsQuery, container.resolve<GetPostsQueryHandler>("GetPostsQueryHandler"));
	queryBus.register(GetPostsByUserQuery, container.resolve<GetPostsByUserQueryHandler>("GetPostsByUserQueryHandler"));
	queryBus.register(
		SearchPostsByTagsQuery,
		container.resolve<SearchPostsByTagsQueryHandler>("SearchPostsByTagsQueryHandler"),
	);
	queryBus.register(GetAllTagsQuery, container.resolve<GetAllTagsQueryHandler>("GetAllTagsQueryHandler"));
	queryBus.register(
		GetLikedPostsByUserQuery,
		container.resolve<GetLikedPostsByUserHandler>("GetLikedPostsByUserHandler"),
	);
	queryBus.register(
		GetUserByPublicIdQuery,
		container.resolve<GetUserByPublicIdQueryHandler>("GetUserByPublicIdQueryHandler"),
	);
	queryBus.register(
		GetUserByUsernameQuery,
		container.resolve<GetUserByUsernameQueryHandler>("GetUserByUsernameQueryHandler"),
	);
	queryBus.register(GetUsersQuery, container.resolve<GetUsersQueryHandler>("GetUsersQueryHandler"));
	queryBus.register(
		CheckFollowStatusQuery,
		container.resolve<CheckFollowStatusQueryHandler>("CheckFollowStatusQueryHandler"),
	);
	queryBus.register(GetFollowersQuery, container.resolve<GetFollowersQueryHandler>("GetFollowersQueryHandler"));
	queryBus.register(GetFollowingQuery, container.resolve<GetFollowingQueryHandler>("GetFollowingQueryHandler"));
	queryBus.register(
		GetAllPostsAdminQuery,
		container.resolve<GetAllPostsAdminQueryHandler>("GetAllPostsAdminQueryHandler"),
	);
	queryBus.register(
		GetAllUsersAdminQuery,
		container.resolve<GetAllUsersAdminQueryHandler>("GetAllUsersAdminQueryHandler"),
	);
	queryBus.register(
		GetAdminUserProfileQuery,
		container.resolve<GetAdminUserProfileQueryHandler>("GetAdminUserProfileQueryHandler"),
	);
	queryBus.register(GetUserStatsQuery, container.resolve<GetUserStatsQueryHandler>("GetUserStatsQueryHandler"));
	queryBus.register(
		GetRecentActivityQuery,
		container.resolve<GetRecentActivityQueryHandler>("GetRecentActivityQueryHandler"),
	);
	queryBus.register(GetRequestLogsQuery, container.resolve<GetRequestLogsQueryHandler>("GetRequestLogsQueryHandler"));

	commandBus.register(
		CreateCommunityCommand,
		container.resolve<CreateCommunityCommandHandler>("CreateCommunityCommandHandler"),
	);
	commandBus.register(
		JoinCommunityCommand,
		container.resolve<JoinCommunityCommandHandler>("JoinCommunityCommandHandler"),
	);
	commandBus.register(
		LeaveCommunityCommand,
		container.resolve<LeaveCommunityCommandHandler>("LeaveCommunityCommandHandler"),
	);
	queryBus.register(
		GetCommunityDetailsQuery,
		container.resolve<GetCommunityDetailsQueryHandler>("GetCommunityDetailsQueryHandler"),
	);
	queryBus.register(
		GetUserCommunitiesQuery,
		container.resolve<GetUserCommunitiesQueryHandler>("GetUserCommunitiesQueryHandler"),
	);
	queryBus.register(
		GetCommunityFeedQuery,
		container.resolve<GetCommunityFeedQueryHandler>("GetCommunityFeedQueryHandler"),
	);
	commandBus.register(
		UpdateCommunityCommand,
		container.resolve<UpdateCommunityCommandHandler>("UpdateCommunityCommandHandler"),
	);
	commandBus.register(
		DeleteCommunityCommand,
		container.resolve<DeleteCommunityCommandHandler>("DeleteCommunityCommandHandler"),
	);
	commandBus.register(KickMemberCommand, container.resolve<KickMemberCommandHandler>("KickMemberCommandHandler"));
	queryBus.register(
		GetAllCommunitiesQuery,
		container.resolve<GetAllCommunitiesQueryHandler>("GetAllCommunitiesQueryHandler"),
	);
	queryBus.register(
		GetCommunityMembersQuery,
		container.resolve<GetCommunityMembersQueryHandler>("GetCommunityMembersQueryHandler"),
	);

	const realtimeHandlers = [
		container.resolve(NewPostMessageHandler),
		container.resolve(GlobalNewPostMessageHandler),
		container.resolve(PostDeletedMessageHandler),
		container.resolve(InteractionMessageHandler),
		container.resolve(LikeUpdateMessageHandler),
		container.resolve(AvatarUpdateMessageHandler),
		container.resolve(RealtimeMessageSentHandler),
	];
	container.register("RealtimeHandlers", { useValue: realtimeHandlers });

	console.info("[di] CQRS initialized (handlers resolved)");
}
