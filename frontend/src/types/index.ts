import {
  InfiniteData,
  UseInfiniteQueryResult,
  UseMutationResult,
  useQuery,
  UseQueryResult,
} from "@tanstack/react-query";
import { Id } from "react-toastify";

interface BaseUserDTO {
  id: string;
  username: string;
  avatar: string;
  cover: string;
  images?: string[];
  followers?: string[];
  following?: string[];
  createdAt: Date;
  bio: string;
}

export interface AdminUserDTO extends BaseUserDTO {
  email: string;
  isAdmin: boolean;
  updatedAt: Date;
}

export interface PublicUserDTO extends BaseUserDTO {}
export type IUser = PublicUserDTO | AdminUserDTO;

export interface ITag {
  _id: string;
  tag: string;
  count?: number;
  modifiedAt?: Date;
}

export interface IImage {
  id: string;
  url: string;
  publicId: string;
  tags: ITag[];
  user: {
    id: String;
    username: string;
  };
  likes: number;
  createdAt: Date;
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
  imagesByTagQuery: (
    tags: string[],
    page: number,
    limit: number
  ) => UseInfiniteQueryResult<PaginatedResponse, Error>;
  deleteImage: (id: string) => any;
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
  actorId: {
    id: string;
    username: string;
  };
  targetId?: string;
  timestamp: string;
  isRead: boolean;
}

export interface UserUserResult {
  useCurrentUser: () => ReturnType<any>;
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
