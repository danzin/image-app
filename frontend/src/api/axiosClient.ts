import axios from 'axios';

const axiosClient = axios.create({
  baseURL: '/api', //relative URL
  withCredentials: true,
});


// Interceptors for better logging of requests/responses
axiosClient.interceptors.request.use(
  (config) => {
    console.log('Request:', {
      method: config.method,
      url: config.url,
      data: config.data,
      params: config.params,
      headers: config.headers,
    });
    return config;
  },
  (error) => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

axiosClient.interceptors.response.use(
  (response) => {
    console.log('Response:', {
      status: response.status,
      data: response.data,
      headers: response.headers,
    });
    return response;
  },
  (error) => {
    if (error.response) {
      console.error('Response Error:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });
      return Promise.reject(error.response.data);
    }
    console.error('Response Error without response:', error);
    return Promise.reject(error);
  }
);

export default axiosClient;