import axiosClient from './axiosClient';
import { IImage } from '../types';

export const fetchImages = async ({ pageParam = 1 }): Promise<{ data: IImage[], total: number, page: number, limit: number, totalPages: number }> => {
  const response = await axiosClient.get(`/api/images?page=${pageParam}`);
  console.log(response.data);
  return response.data ;
};

export const fetchImageById = async(id: string) => {
  const { data } = await axiosClient.get(`/api/images/${id}`);
  return data;
}

export const fetchImagesByTag = async({tags, page, limit}: {tags: string[],page: number, limit: number }) => {
  const tagString = tags.join(','); 
  const { data } = await axiosClient.get(`/api/images/search/tags?tags=${tagString}&page=${page}&limit=${limit}`);
  console.log(data);
  return data;
}

export const uploadImage = async(image: FormData): Promise<IImage> => {
  const token = localStorage.getItem('token');

  const response = await axiosClient.post('/api/images/upload', image, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return response.data;
}

export const fetchTags = async() : Promise<string[]> => {
  const {data} = await axiosClient.get('/api/images/tags');
  console.log(data);
  return data;
}
