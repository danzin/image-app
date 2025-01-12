import { useMutation } from '@tanstack/react-query';
import axiosClient from './axiosClient';

export const registerRequest = async (credentials: any) => {
  const response = await axiosClient.post('/api/users/register', credentials);
  return response.data;
};

export const useRegister = () => {
  return useMutation({
    mutationFn: registerRequest,
    onSuccess: (data) => {
      console.log('Registration successful:', data);

    },
    onError: (error) => {
      console.error('Registration failed:', error.message);
    },
  });
};
