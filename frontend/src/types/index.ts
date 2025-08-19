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
	_id: string;
	tag: string;
	count?: number;
	modifiedAt?: Date;
}

export interface IImage {
	publicId: string;
	slug: string;
	url: string;
	title?: string;
	tags: string[]; // Just tag names, not full tag objects
	user: {
		publicId: string;
		username: string;
		avatar: string;
	};
	likes: number;
	commentsCount: number;
	createdAt: Date;
	isLikedByViewer?: boolean; // Only when user is authenticated
}

export interface IComment {
	id: string;
	content: string;
	imagePublicId: string; // Using image public ID instead of internal ID
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

export interface PaginatedResponse {
	pages: {
		data: IImage[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	}[];
}
export interface UseImagesResult {
	imagesQuery: UseInfiniteQueryResult<PaginatedResponse, Error>;
	imageByIdQuery: (id: string) => UseInfiniteQueryResult<IImage, Error>;
	uploadImageMutation: UseMutationResult<unknown, Error, unknown, unknown>;
	tagsQuery: UseQueryResult<string[], Error>;
	imagesByTagQuery: (tags: string[], page: number, limit: number) => UseInfiniteQueryResult<PaginatedResponse, Error>;
	deleteImage: (id: string) => Promise<void>;
}

export interface TagsProps {
	selectedTags: string[];
	onSelectTags: (tags: ITag[]) => void;
}

export interface GalleryProps {
	images: IImage[];
	fetchNextPage: () => void;
	hasNextPage?: boolean;
	isFetchingNext?: boolean;
	isLoadingFiltered?: boolean;
	isLoadingAll?: boolean;
}

export interface Notification {
	id: string;
	userId: string;
	actionType: string;
	actorId: string; // Just the actor's publicId as string
	actorUsername?: string; // Optional denormalized username
	targetId?: string;
	timestamp: string;
	isRead: boolean;
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
