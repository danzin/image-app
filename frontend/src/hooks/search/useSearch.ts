import { useQuery, useQueryClient } from '@tanstack/react-query';
import { searchQuery } from '../../api/searchApi';

export const useSearch = (query: string) => {
  const queryClient = useQueryClient();

  const searchResults = useQuery({
    queryKey: ['query', query],
    queryFn: () => searchQuery(query), 
    staleTime: 0,
    enabled: !!query, // run when query exists
    retry: 1,
  });

  const invalidateSearch = () => {
    queryClient.invalidateQueries({ 
      queryKey: ['query', query],
      exact: true
    });
  };

  return { ...searchResults, invalidateSearch };
};