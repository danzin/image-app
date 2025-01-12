import axiosClient from './axiosClient';

export interface User { 
  id: string;
  name: string;
  email: string;
  images: string[];
}


// Fetch current user function
export const fetchUser = async () => {
  const token = localStorage.getItem('token'); // Retrieve the token from local storage

  const { data } = await axiosClient.get('/api/users/me', {
    headers: {
    Authorization: `Bearer ${token}`
  }} );

  return data;
};

