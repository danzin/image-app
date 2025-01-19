import axiosClient from './axiosClient';
import { Image } from './imageApi';

export interface User { 
  id: string;
  name: string;
  email: string;
  images: string[];
}


export const fetchUser = async () => {
  const token = localStorage.getItem('token'); 
  const { data } = await axiosClient.get('/api/users/me', {
    headers: {
    Authorization: `Bearer ${token}`
  }} );

  return data;
};

export const fetchUserImages = async ({ pageParam = 1, userId }: { pageParam?: number, userId: string }): Promise<{ data: Image[], total: number, page: number, limit: number, totalPages: number }> => {
  const token = localStorage.getItem('token');
  const { data } = await axiosClient.get(`/api/images/user/${userId}?page=${pageParam}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return data;
};