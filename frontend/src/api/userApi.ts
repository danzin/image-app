import axiosClient from './axiosClient';
import { IImage, IUser } from '../types';

export const fetchCurrentUser = async () => {
  const token = localStorage.getItem('token'); 
  const { data } = await axiosClient.get('/users/me', {
    headers: {
    Authorization: `Bearer ${token}`
  }} );

  return data;
};

/**
 * react query expects this function not to take any parameter directly, 
 * but instead to receive an object containing a queryKey.
 * const [_, id] = queryKey extracts the required value from the queryKey object.
 * It's later called within a hook with the userId as parameter
 * and used as [QueryFn] callback within useQuery with  
*/

export const fetchUserData = async ({queryKey}): Promise<any> => {
  try {
    const [_, id] = queryKey;
    const response = await axiosClient(`/users/${id}`);
    console.log('response from fetchUserData: ', response.data)
    return response.data;
  } catch (error) {
    console.error(error)
  }
}



export const fetchUserImages = async (pageParam, userId):
  Promise<{
    data: IImage[];
    total: number;
    page: number;
    limit: number;
    totalPages: number; }> => {
  const token = localStorage.getItem('token');
  const { data } = await axiosClient.get(
    `/images/user/${userId}?page=${pageParam}`, 
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
  const { data } = await axiosClient.post('/users/avatar', avatar, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return data;
};

export const updateUserCover = async (cover: FormData): Promise<any> => {
  const token = localStorage.getItem('token');
  const { data } = await axiosClient.post('/users/cover', cover, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return data;
}
