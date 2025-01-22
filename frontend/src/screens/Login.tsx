import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../api/login';
import AuthForm from '../components/AuthForm';
import { ToastContainer, toast } from 'react-toastify';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { mutateAsync: loginMutation } = useLogin();

  const notifySuccess = () => toast.success("Login successful!"); 
  const notifyError = (message: string) => toast.error(`Login failed: ${message}`);

  const handleLogin = async (formData: { email: string; password: string }) => {
    try {
      await loginMutation({email: formData.email, password: formData.password});
      notifySuccess();
      setTimeout(() => navigate('/'), 1500)
    } catch (error: any) {
      notifyError(error.message);
    }  
  };

  return (
    <>
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
            <ToastContainer />

    </>
  );
};

export default Login;