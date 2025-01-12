import axiosClient from './axiosClient';

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

