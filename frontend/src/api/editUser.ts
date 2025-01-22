import axiosClient from './axiosClient';

export const editUserRequest = async (updateData: any) => {
  console.log('updateData:', updateData);
  const response = await axiosClient.post('/users/edit', updateData, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });
  console.log('responseData:',response.data);
  return response.data;
};

