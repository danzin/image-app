import { useMutation } from '@tanstack/react-query';
import axiosClient from './axiosClient';

export const editUserRequest = async (updateData: any) => {
  console.log('updateData:', updateData);
  const response = await axiosClient.post('/api/users/edit', updateData, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });
  console.log('responseData:',response.data);
  return response.data;
};

export const useEditUser = () => {
  return useMutation({
    mutationFn: editUserRequest,
    onSuccess: (data) => {
      console.log('User updated successfully:', data);
    },
    onError: (error) => {
      console.error('User update failed:', error.message);
    },
  });
};