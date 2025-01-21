import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchImages, fetchImageById, uploadImage, fetchTags, fetchImagesByTag } from '../api/imageApi';
import { IImage, UseImagesResult } from '../types'


export const useImages = (): UseImagesResult => {
  const queryClient = useQueryClient();

  const imagesQuery = useInfiniteQuery<{ data: IImage[], total: number, page: number, limit: number, totalPages: number }, Error>({
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

  const imageByIdQuery = (id: string) => useQuery<IImage, Error>({
    queryKey: ['image', id],
    queryFn: () => fetchImageById(id),
  });

  const uploadImageMutation = useMutation<IImage, Error, FormData>({
    mutationFn: uploadImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
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
    tagsQuery,
    imagesByTagQuery,
  };
};
