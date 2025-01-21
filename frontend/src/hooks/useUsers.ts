import { InfiniteData, useInfiniteQuery, UseInfiniteQueryResult, useQuery } from '@tanstack/react-query';
import { fetchUser, fetchUserImages,  } from '../api/userApi';
import { IImage, IUser } from '../types';
import { UserUserResult } from '../types';


export const useUser = (): UserUserResult => {
  
  const useCurrentUser = () => {
    return useQuery<IUser>({
      queryKey: ['user'],
      queryFn: fetchUser,
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    });
  };
  
  const userQuery = useQuery<IUser, Error>({
    queryKey: ['user'],
    queryFn: fetchUser,
  });
  
  const useUserImages = (userId: string) => {
    return useInfiniteQuery<
      { data: IImage[]; total: number; page: number; limit: number; totalPages: number },
      Error
    >({
      queryKey: ['userImages', userId],
      queryFn: ({ pageParam = 1 }) => fetchUserImages({ pageParam, userId }), // Pass `pageParam`
      getNextPageParam: (lastPage) => {
        if (lastPage.page < lastPage.totalPages) {
          return lastPage.page + 1;
        }
        return undefined; // No more pages to fethc
      },
      initialPageParam: 1, // Start from the first page
    });
  };
  
  
  return {
    
    useCurrentUser,
    userQuery,
    useUserImages
  };
}

