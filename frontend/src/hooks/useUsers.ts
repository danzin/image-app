import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { fetchUser, fetchUserImages } from '../api/userApi';
import { IImage, IUser } from '../types';

  export const useCurrentUser = () => {
    return useQuery<IUser>({
      queryKey: ['user'],
      queryFn: fetchUser,
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    });
  };

export const useUserImages = (userId: string) => {
  console.log('useUserImages called with userId:', userId); // Add this log
  
  return useInfiniteQuery<
    { data: IImage[]; total: number; page: number; limit: number; totalPages: number },
    Error
  >({
    queryKey: ['userImages', userId],
    queryFn: ({ pageParam = 1 }) => {
      console.log('Fetching images for userId:', userId, 'page:', pageParam); // Add this log
      return fetchUserImages({ pageParam, userId });
    },
    getNextPageParam: (lastPage) => {
      console.log('Getting next page param:', lastPage); // Add this log
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: !!userId && userId !== '', // Make sure we have a valid userId
  });
};
  
