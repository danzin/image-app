import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../hooks/user/useUserLogin';
import AuthForm from '../components/AuthForm';
import { ToastContainer, toast } from 'react-toastify';
import { Box, Container } from '@mui/material'; 

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { mutate: loginMutation, isPending } = useLogin(); 

  const notifySuccess = () => toast.success("Login successful!");
  const notifyError = (message: string) => toast.error(`Login failed: ${message}`);

  const handleLogin = async (formData: { email: string; password: string }) => {
    loginMutation({ email: formData.email, password: formData.password }, {
      onSuccess: () => {
        notifySuccess();
        navigate('/');
      },
      onError: (error: any) => {
        notifyError(error?.message || 'An unknown error occurred');
      }
    });
  };

  return (
    <Box
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center', 
        py: 4, 
        width: '100%' 
      }}
    >
      {/* Container limits max width on larger screens */}
      <Container maxWidth="xs">
        <AuthForm
          title="Login"
          fields={[
            { name: 'email', label: 'Email Address', type: 'email', autoComplete: 'email', required: true },
            { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password', required: true },
          ]}
          onSubmit={handleLogin}
          isSubmitting={isPending} 
          submitButtonText="Sign In"
          linkText="Don't have an account? Sign Up"
          linkTo="/register"
        />
      </Container>
      <ToastContainer />
    </Box>
  );
};

export default Login;