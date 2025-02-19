import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { followUser, likeImage } from '../../api/userActions';
import { fetchIsFollowing } from '../../api/userApi';
import { PaginatedResponse } from '../../types';

// Hook to follow a user
export const useFollowUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: followUser,
    onSuccess: (_data, _followeeId) => {
      // Invalidate query for isFollowing
      queryClient.invalidateQueries({ queryKey: ['isFollowing'] });
      // Invalidate query for the user's followers array update
      queryClient.invalidateQueries({ queryKey: ['user'] });

    },
    onError: (error: any) => {
      console.error('Error following user:', error.message || error);
    },
  });
};

// Hook to like an image
export const useLikeImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: likeImage, // Calls API to like/unlike
    onSuccess: (updatedImage) => {
      queryClient.setQueryData(['personalizedFeed'], (oldData: PaginatedResponse | undefined) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            data: page.data.map((image) =>
              image.id === updatedImage.id ? updatedImage : image 
            ),
          })),
        };
      });
    },
    onError: (error) => {
      console.error('Error liking image:', error);
    },
  });
};




// Hook checking if current logged in user is following the profile they're visiting
export const useIsFollowing = (followeeId: string) => {
  return useQuery({
    queryKey: ['isFollowing', followeeId],
    queryFn: fetchIsFollowing,
    staleTime: 1000*60,
    refetchOnMount: false,
    refetchOnWindowFocus: false
  })
};
