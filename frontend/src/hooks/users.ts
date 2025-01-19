import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { fetchUser, fetchUserImages, User } from '../api/userApi';
import { Image } from '../api/imageApi';

export const useCurrentUser = () => {
  return useQuery<User>({
    queryKey: ['user'],
    queryFn: fetchUser,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};

export const useUserImages = (userId: string) => {
  return useInfiniteQuery<{ data: Image[], total: number, page: number, limit: number, totalPages: number }, Error>({
    queryKey: ['userImages', userId],
    queryFn: ({ pageParam = 1 }) => fetchUserImages({ pageParam, userId }),
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });
};