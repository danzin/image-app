import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { followUser, likeImage } from '../../api/userActions';
import { fetchIsFollowing } from '../../api/userApi';

// Hook to follow a user
export const useFollowUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: followUser,
    onSuccess: (_data, followeeId) => {
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
    mutationFn: likeImage,
    onSuccess: (_data, imageId) => {
      // Invalidate image queries so the like count or status refreshes
      queryClient.invalidateQueries({ queryKey: ['images'] });
      
    },
    onError: (error: any) => {
      console.error('Error liking image:', error.message || error);
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
