import axiosClient from './axiosClient';
import { IImage } from '../types';

export const fetchUser = async () => {
  const token = localStorage.getItem('token'); 
  const { data } = await axiosClient.get('/api/users/me', {
    headers: {
    Authorization: `Bearer ${token}`
  }} );

  return data;
};

export const fetchUserImages = async ({pageParam = 1,}:{pageParam?: number;}):
  Promise<{
    data: IImage[];
    total: number;
    page: number;
    limit: number;
    totalPages: number; }> => {
  const token = localStorage.getItem('token');
  const { data } = await axiosClient.get(
    `/api/images/user/?page=${pageParam}`, 
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return data;
};

export const updateUserAvatar = async (avatar: FormData): Promise<any> => {
  const token = localStorage.getItem('token');
  const { data } = await axiosClient.post('api/users/avatar', avatar, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return data;
};

