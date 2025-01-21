import { InfiniteData, useInfiniteQuery, UseInfiniteQueryResult, useMutation, useQuery } from "@tanstack/react-query";

export interface IUser {
  username: string;
  email: string;
  images: string[];
  isAdmin: boolean;
}


export interface IImage {
  _id: string;
  url: string;
  publicId: string;
  tags: string[];
  uploadedBy: string;
}

export interface UseImagesResult {
  imagesQuery: ReturnType<typeof useInfiniteQuery>;
  imageByIdQuery: (id: string) => ReturnType<typeof useQuery>;
  uploadImageMutation: ReturnType<typeof useMutation>;
  tagsQuery: ReturnType<typeof useQuery>;
  imagesByTagQuery: (tags: string[], page: number, limit: number) => ReturnType<typeof useInfiniteQuery>;
}

export interface TagsProps {
  selectedTags: string[];
  onSelectTags: (tags: string[]) => void;
}

export interface GalleryProps {
  images: (IImage)[];
}

export interface UserUserResult {
  useCurrentUser: () => ReturnType<any>;
  useUserImages: (userId: string) => UseInfiniteQueryResult<InfiniteData<{ data: IImage[], total: number, page: number, limit: number, totalPages: number }, unknown>, Error>;
  userQuery: ReturnType<typeof useQuery>;
}


export interface UploadFormProps {
  onClose: () => void;
}