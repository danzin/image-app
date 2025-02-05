import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchImages, fetchImageById, uploadImage, fetchTags, fetchImagesByTag, deleteImageById } from '../api/imageApi';
import { IImage } from '../types';

export const useImages = () => {
  return useInfiniteQuery<{ data: IImage[], total: number, page: number, limit: number, totalPages: number }, Error>({
    queryKey: ['images'],
    queryFn: ({ pageParam = 1 }) => fetchImages({pageParam} as any) ,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useImageById = (id: string) => {
  return useQuery<IImage, Error>({
    queryKey: ['image', id],
    queryFn: () => fetchImageById(id),
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useImagesByTag = (tags: string[], limit = 10) => {
  return useInfiniteQuery<{ data: IImage[], total: number, page: number, limit: number, totalPages: number }, Error>({
    queryKey: ['imagesByTag', tags],
    queryFn: ({ pageParam = 1 }) => fetchImagesByTag({ tags, page: pageParam as number, limit }),
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    enabled: tags.length > 0,
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useTags = () => {
  return useQuery<string[], Error>({
    queryKey: ['tags'],
    queryFn: fetchTags,
    staleTime: 0,
    refetchOnMount: true,
  });
};

export const useUploadImage = () => {
  const queryClient = useQueryClient();
  
  return useMutation<IImage, Error, FormData>({
    mutationFn: uploadImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['userImages'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (error: Error) => {
      console.error('Error uploading image:', error);
    }
  });
};

export const useDeleteImage = () => {
  const queryClient = useQueryClient();
  
  return useMutation<void, Error, string>({
    mutationFn: deleteImageById,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['userImages'] });
    },
    onError: (error: Error) => {
      console.error('Error deleting image:', error);
    }
  });
};
