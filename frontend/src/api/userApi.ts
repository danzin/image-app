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

export const fetchUserImages = async ({
  pageParam = 1,
  userId,
}: {
  pageParam?: number;
  userId: string;
}): Promise<{
  data: IImage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> => {
  const token = localStorage.getItem('token');
  const { data } = await axiosClient.get(
    `/api/images/user/?page=${pageParam}`, // Correctly pass `pageParam`
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return data;
};

