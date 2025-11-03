import {
	InfiniteData,
	UseInfiniteQueryResult,
	UseMutationResult,
	useQuery,
	UseQueryResult,
} from "@tanstack/react-query";
import { Id } from "react-toastify";

// Base user interface matching backend DTOs
export interface PublicUserDTO {
	publicId: string;
	username: string;
	avatar: string;
	cover: string;
	bio: string;
	createdAt: Date;
	followerCount: number;
	followingCount: number;
	imageCount: number;
}

export interface AuthenticatedUserDTO extends PublicUserDTO {
	email: string; // Only for the user themselves
}

export interface AdminUserDTO extends AuthenticatedUserDTO {
	isAdmin: boolean;
	isBanned: boolean;
	bannedAt?: Date;
	bannedReason?: string;
	bannedBy?: string;
	updatedAt: Date;
}

// Main user type for the frontend - can be any of the DTO types
export type IUser = PublicUserDTO | AuthenticatedUserDTO | AdminUserDTO;

export interface ITag {
	id: string;
	tag: string;
	count?: number;
	modifiedAt?: Date;
	score?: number;
}

export interface IPost {
	publicId: string;
	slug?: string;
	body?: string; // Post text

	// Image data
	image?: {
		url: string;
		publicId: string;
	} | null;

	// Legacy: Keep url at top level for backward compatibility
	url?: string;
	imagePublicId?: string;

	tags: string[];

	user: {
		publicId: string;
		username: string;
		avatar: string;
	};

	likes: number;
	commentsCount: number;
	viewsCount: number;
	createdAt: Date;

	isLikedByViewer: boolean;
	isFavoritedByViewer: boolean;
}

/**
 * Legacy IImage interface - for backward compatibility
 */
export interface IImage extends IPost {
	url: string; // Required for images
	title?: string;
}

/**
 * Type guard to check if post has an image
 */
export function isImagePost(post: IPost): post is IImage {
	return !!post.image || !!post.url;
}

/**
 * Type guard for text-only posts
 */
export function isTextPost(post: IPost): boolean {
	return !!post.body && !post.image && !post.url;
}

export interface IComment {
	id: string;
	content: string;
	postPublicId: string;
	user: {
		publicId: string;
		username: string;
		avatar?: string;
	};
	createdAt: Date;
	updatedAt: Date;
	isEdited: boolean;
}

export interface CommentCreateDto {
	content: string;
}

export interface CommentUpdateDto {
	content: string;
}

export interface CommentsPaginationResponse {
	comments: IComment[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export type PageParam = number;

export type ImagePageData = {
	data: IImage[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
};

export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}
export interface UseImagesResult {
	imagesQuery: UseInfiniteQueryResult<InfiniteData<PaginatedResponse<IImage>>, Error>;
	imageByIdQuery: (id: string) => UseQueryResult<IImage, Error>;
	uploadImageMutation: UseMutationResult<unknown, Error, unknown, unknown>;
	tagsQuery: UseQueryResult<string[], Error>;
	imagesByTagQuery: (
		tags: string[],
		page: number,
		limit: number
	) => UseInfiniteQueryResult<InfiniteData<PaginatedResponse<IImage>>, Error>;
	deleteImage: (id: string) => Promise<void>;
}

export interface GalleryProps {
	posts: (IImage | IPost)[];
	fetchNextPage: () => void;
	hasNextPage?: boolean;
	isFetchingNext?: boolean;
	isLoadingAll?: boolean;
	emptyTitle?: string;
	emptyDescription?: string;
}

export interface Notification {
	id: string;
	userId: string;
	actionType: string; // 'like' | 'comment' | 'follow'
	actorId: string; // actor's publicId
	actorUsername?: string; // denormalized username
	actorAvatar?: string; // actor avatar URL
	targetId?: string; // post/image publicId
	targetType?: string; // 'post' | 'image' | 'user'
	targetPreview?: string; // preview text/snippet
	timestamp: string;
	isRead: boolean;
}

export interface MessageAttachment {
	url: string;
	type: string;
	mimeType?: string;
	thumbnailUrl?: string;
}

export interface MessageDTO {
	publicId: string;
	conversationId: string;
	body: string;
	sender: {
		publicId: string;
		username: string;
		avatar: string;
	};
	attachments: MessageAttachment[];
	status: "sent" | "delivered" | "read";
	createdAt: string;
	readBy: string[];
}

export interface ConversationParticipantDTO {
	publicId: string;
	username: string;
	avatar: string;
}

export interface ConversationSummaryDTO {
	publicId: string;
	participants: ConversationParticipantDTO[];
	lastMessage?: MessageDTO | null;
	lastMessageAt?: string | null;
	unreadCount: number;
	isGroup: boolean;
	title?: string;
}

export interface MessagingUpdatePayload {
	type: "message_sent";
	conversationId: string;
	messageId?: string;
	senderId: string;
	timestamp: string;
}

export interface UserUserResult {
	useCurrentUser: () => IUser | null;
	useUserImages: (userId: string) => UseInfiniteQueryResult<
		InfiniteData<
			{
				data: IImage[];
				total: number;
				page: number;
				limit: number;
				totalPages: number;
			},
			unknown
		>,
		Error
	>;
	userQuery: ReturnType<typeof useQuery>;
}

export interface UploadFormProps {
	onClose: () => void;
}

export interface AuthContextData {
	//logout and checkAuthState are async and return a promise.
	logout: () => Promise<void>;
	checkAuthState: () => Promise<void>;

	login: (user: IUser) => void;

	loading: boolean;
	isLoggedIn: boolean;
	user: IUser | null;
	error: string | null;
}
export interface ImageCardProps {
	image: IImage;
	onClick: (image: IImage) => void;
}

export interface PostCardProps {
	post: IPost;
}

export interface ImageEditorProps {
	onImageUpload: (croppedImage: Blob | null) => void;
	type: "avatar" | "cover";
	aspectRatio?: number;
	onClose: () => void;
}

export interface EditProfileProps {
	onComplete: () => void;
	notifySuccess: (message: string) => Id;
	notifyError: (message: string) => Id;
	initialData?: IUser | null;
}

export interface ChangePasswordProps {
	onComplete: () => void;
	notifySuccess: (message: string) => Id;
	notifyError: (message: string) => Id;
}

export type RegisterForm = {
	username: string;
	email: string;
	password: string;
	confirmPassword: string;
};

interface AuthFormField<T> {
	name: keyof T;
	label: string;
	type: string;
	autoComplete?: string;
	required: boolean;
}

export interface AuthFormProps<T> {
	title: string;
	fields: AuthFormField<T>[];
	onSubmit: (formData: T) => void;
	isSubmitting?: boolean;
	error?: string | null;
	submitButtonText: string;
	linkText?: string;
	linkTo?: string;
	initialValues?: Partial<T>;
}

export interface ConversationListResponse {
	conversations: ConversationSummaryDTO[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface ConversationMessagesResponse {
	messages: MessageDTO[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface SendMessageRequest {
	conversationPublicId?: string;
	recipientPublicId?: string;
	body: string;
	attachments?: MessageAttachment[];
}

export interface InitiateConversationResponse {
	conversation: ConversationSummaryDTO;
}

// Who to follow suggestions
export interface SuggestedUser {
	publicId: string;
	username: string;
	avatar: string;
	bio?: string;
	followerCount: number;
	postCount: number;
	totalLikes: number;
	score: number;
}

export interface WhoToFollowResponse {
	suggestions: SuggestedUser[];
	cached: boolean;
	timestamp: string;
}
