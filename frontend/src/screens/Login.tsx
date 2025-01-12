import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../api/login';
import AuthForm from '../components/AuthForm';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { mutateAsync: loginMutation } = useLogin();

  const handleLogin = (formData: { email: string; password: string }) => {
    try {
      loginMutation({email: formData.email, password: formData.password});
      navigate('/');
    } catch (error: any) {
      console.error('Login failed:', error.message);
    }  
  };

  return (
    <AuthForm
      title="Login"
      fields={[
        { name: 'email', type: 'email', placeholder: 'email@example.com' },
        { name: 'password', type: 'password', placeholder: '********' },
      ]}
      onSubmit={handleLogin}
      submitButtonText="Login"
      linkText="Don't have an account?"
      linkTo="/register"
    />
  );
};

export default Login;