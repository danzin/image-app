import { useQuery, useMutation, UseQueryResult, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { fetchImages, fetchImageById, uploadImage, Image } from '../api/imageApi';
import { fetchUser, User } from '../api/userApi';

interface UseImagesResult {
  
  imagesQuery: UseQueryResult<Image[], Error>;
  imageByIdQuery: (id: string) => UseQueryResult<Image, Error>;
  uploadImageMutation: UseMutationResult<Image, Error, FormData>;
  userQuery: UseQueryResult<User, Error>;
}




export const useImages = (): UseImagesResult => {
  const queryClient = useQueryClient();

  const imagesQuery = useQuery<Image[], Error>({
    queryKey: ['images'],
    queryFn: fetchImages,
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