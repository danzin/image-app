import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import axiosClient from './axiosClient';

export const loginRequest = async (credentials: any) => {
  const response = await axiosClient.post('/users/login', credentials);
  return response.data;
};

export const useLogin = () => {
  const { login } = useAuth();
  return useMutation({
    mutationFn: loginRequest,
    onSuccess: (data) => {

      login(data.user, data.token);
    },
    onError: (error) => {
      console.error('Login failed:', error.message);
    },
  });
};
