import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentUser, fetchUserData, fetchUserImages, updateUserAvatar, updateUserCover } from '../api/userApi';
import { IImage, IUser } from '../types';
import { editUserRequest } from '../api/editUser';
import { useAuth } from '../context/AuthContext';

  export const useCurrentUser = () => {
    return useQuery<IUser>({
      queryKey: ['user'],
      queryFn: fetchCurrentUser,
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    });
  };
  
  

  export const useGetUser = (id: string) => {
    return useQuery({
      queryKey: ['user', id],
      queryFn: fetchUserData, 
      staleTime: 0,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    });
  };


export const useUserImages = (userId: string) => {
  console.log('useUserImages called with userId:', userId); 
  
  return useInfiniteQuery<{ data: IImage[]; total: number; page: number; limit: number; totalPages: number },Error>(
    {
    queryKey: ['userImages', userId],
    queryFn: ({ pageParam = 1 }) => {
      console.log('Fetching images for userId:', userId, 'page:', pageParam); 
      return fetchUserImages(pageParam as number, userId);
    },
    getNextPageParam: (lastPage) => {
      console.log('Getting next page param:', lastPage); 
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
    enabled: !!userId && userId !== '', 
  });
};
  
//THE CORRECT WAY TO WRITE MUTATIONS! ALWAYS REFER HERE WHEN WTFING LATER!!!!!!!!!
export const useUpdateUserAvatar = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (avatar: FormData) => updateUserAvatar(avatar),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (error: Error) => {
      console.error('Error updating avatar: ', error);
    }
  });
};

export const useUpdateUserCover = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cover: FormData) => updateUserCover(cover),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['user']});
    },
    onError: (error: Error) => {
      console.error('Error updating cover: ', error)
    }
  })
}

export const useEditUser = () => {
  const queryClient = useQueryClient(); // Get the QueryClient instance

  return useMutation({
    mutationFn: editUserRequest,
    
    onSuccess: (data) => {
      console.log('User updated successfully:', data);
      
      queryClient.setQueryData(['user'], (oldData: {}) => ({
        ...oldData,
        ...data, // Merge the updated data with the existing data
      }));
      queryClient.invalidateQueries(['user', data.id]);
    },
    onError: (error) => {
      console.error('Userdate failed:', error.message);
    },
  });
};