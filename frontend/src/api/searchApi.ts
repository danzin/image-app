import { IImage, ITag, IUser } from '../types';
import axiosClient from './axiosClient';

export const searchQuery = async (query: string): Promise<{
  status: string,
  data: {
    users: IUser[] | string,
    images:IImage[] | string,
    tags: ITag[] | string
  }
}> => {

  const { data } = await axiosClient.get(`/search?q=${query}`)
  console.log(`Search Data: ${data}`)
  return data
}