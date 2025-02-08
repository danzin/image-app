import { useQuery } from '@tanstack/react-query';
import { searchQuery } from '../../api/searchApi';
import { IImage, ITag, IUser } from '../../types';

export const useSearch = (query: string) => {
  return useQuery<{
    status: string,
    data: {
      users: IUser[] | string,
      images: IImage[] | string,
      tags: ITag[] | string,
    }
  }>({
    queryKey: ['query', query],
    queryFn: () => searchQuery(query),
    staleTime: 0,
    refetchOnMount: true,
  });
};