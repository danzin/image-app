import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchImages, fetchImageById, uploadImage, Image } from '../api/imageApi';
import { fetchUser, User } from '../api/userApi';


interface UseImagesResult {
  imagesQuery: ReturnType<typeof useInfiniteQuery>;
  imageByIdQuery: (id: string) => ReturnType<typeof useQuery>;
  uploadImageMutation: ReturnType<typeof useMutation>;
  userQuery: ReturnType<typeof useQuery>;
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
    initialPageParam: 1, // Add initialPageParam
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

  return {
    imagesQuery,
    imageByIdQuery,
    uploadImageMutation,
    userQuery,
  };
};