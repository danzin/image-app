import axios from 'axios';

const axiosClient = axios.create({
  baseURL: 'http://127.0.0.1:12000',
  withCredentials: true,  
});

axiosClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
);



export default axiosClient;