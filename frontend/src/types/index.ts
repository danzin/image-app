import { InfiniteData, useInfiniteQuery, UseInfiniteQueryResult, useMutation, useQuery } from "@tanstack/react-query";

export interface IUser {
  id: string;
  username: string;
  avatar: string;
  cover: string;
  email: string;
  isAdmin: boolean;
  images: string[];
  followers: string[];
  following: string[];
}

interface Tag {
  tag: string;
  count?: number; 
  modifiedAt?: Date; 
}

export interface IImage {
  id: string;
  url: string;
  publicId: string;
  tags: Tag[];
  user: {
    id: String,
    username: string
  };
  likes: number;
  createdAt: Date;
}

export interface UseImagesResult {
  imagesQuery: ReturnType<typeof useInfiniteQuery>;
  imageByIdQuery: (id: string) => ReturnType<typeof useQuery>;
  uploadImageMutation: ReturnType<typeof useMutation>;
  tagsQuery: ReturnType<typeof useQuery>;
  imagesByTagQuery: (tags: string[], page: number, limit: number) => ReturnType<typeof useInfiniteQuery>;
  deleteImage: (id: string) => any
}

export interface TagsProps {
  selectedTags: string[];
  onSelectTags: (tags: string[]) => void;
}

export interface GalleryProps {
  images: IImage[] | undefined;  // Make images possibvly undefined 
  fetchNextPage: () => void;
  hasNextPage: boolean | undefined;
  isFetchingNext: boolean;
  source: string | undefined;
}

export interface UserUserResult {
  useCurrentUser: () => ReturnType<any>;
  useUserImages: (userId: string) => UseInfiniteQueryResult<InfiniteData<{ data: IImage[], total: number, page: number, limit: number, totalPages: number }, unknown>, Error>;
  userQuery: ReturnType<typeof useQuery>;
}


export interface UploadFormProps {
  onClose: () => void;
}

export interface AuthContextData {
  checkAuthState: () => void; 
  loading: boolean;
  isLoggedIn: boolean;
  user: IUser | null;
  login: (user: IUser) => void;
  logout: () => void;
}
export interface ImageCardProps {
  image: IImage;
  onClick: (image: IImage) => void;
}