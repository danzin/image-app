import axiosClient from './axiosClient';

export interface Image {
  _id: string;
  url: string;
  publicId: string;
}

export const fetchImages = async(): Promise<Image[]> => {
  const { data } = await axiosClient.get('/api/images');
  return data;
};

export const fetchImageById = async(id: string) => {
  const { data } = await axiosClient.get(`/api/images/${id}`);
  return data;
}

export const uploadImage = async(image: FormData): Promise<Image> => {
  const token = localStorage.getItem('token');

  const response = await axiosClient.post('/api/images/upload', image, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return response.data;
}
