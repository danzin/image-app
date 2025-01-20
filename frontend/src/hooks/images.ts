import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchImages, fetchImageById, uploadImage, Image, fetchTags, fetchImagesByTag } from '../api/imageApi';
import { fetchUser, User } from '../api/userApi';

interface UseImagesResult {
  imagesQuery: ReturnType<typeof useInfiniteQuery>;
  imageByIdQuery: (id: string) => ReturnType<typeof useQuery>;
  uploadImageMutation: ReturnType<typeof useMutation>;
  userQuery: ReturnType<typeof useQuery>;
  tagsQuery: ReturnType<typeof useQuery>;
  imagesByTagQuery: (tags: string[], page: number, limit: number) => ReturnType<typeof useInfiniteQuery>;
}

export const useImages = (): UseImagesResult => {
  const queryClient = useQueryClient();

  const imagesQuery = useInfiniteQuery<{ data: Image[], total: number, page: number, limit: number, totalPages: number }, Error>({
    queryKey: ['images'],
    queryFn: fetchImages,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1, 
  });

  const imageByIdQuery = (id: string) => useQuery<Image, Error>({
    queryKey: ['image', id],
    queryFn: () => fetchImageById(id),
  });

  const uploadImageMutation = useMutation<Image, Error, FormData>({
    mutationFn: uploadImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const userQuery = useQuery<User, Error>({
    queryKey: ['user'],
    queryFn: fetchUser,
  });

  const tagsQuery = useQuery<string[], Error>({
    queryKey: ['tags'],
    queryFn: fetchTags,
  });

  const imagesByTagQuery = (tags: string[], page: number, limit: number) => useInfiniteQuery({
    queryKey: ['imagesByTag', tags, page, limit],
    queryFn: ({ pageParam = 1 }) => fetchImagesByTag({ tags, page: pageParam, limit }),
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });
  
  return {
    imagesQuery,
    imageByIdQuery,
    uploadImageMutation,
    userQuery,
    tagsQuery,
    imagesByTagQuery,
  };
};
