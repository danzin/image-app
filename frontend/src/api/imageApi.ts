import axiosClient from './axiosClient';

export interface Image {
  _id: string;
  url: string;
  publicId: string;
}


export const fetchImages = async ({ pageParam = 1 }): Promise<{ data: Image[], total: number, page: number, limit: number, totalPages: number }> => {
  const response = await axiosClient.get(`/api/images?page=${pageParam}`);
  console.log(response.data);
  return response.data;
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
