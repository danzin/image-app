import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegister } from '../hooks/user/useUserRegister';
import AuthForm from '../components/AuthForm';
import { ToastContainer } from 'react-toastify';
import { Box, Container } from '@mui/material';
import { RegisterForm } from '../types';

const Register: React.FC = () => {
  const { mutate: registerMutation, isPending, isSuccess } = useRegister(); 
  const navigate = useNavigate();

  useEffect(() => {
    if (isSuccess) {
      console.log("Login success detected in component, navigating...");
      const timer = setTimeout(() => navigate('/login'), 1000);
      return () => clearTimeout(timer); 
    }
  }, [isSuccess, navigate]); 

  const handleRegister = async (formData: { username: string; email: string; password: string }) => {
   registerMutation(formData)
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
    <Container maxWidth="xs">
      <AuthForm<RegisterForm> // add RegisterForm type in order to give TS a concrete `T` type and use confirmPassword field 
        title="Create Account"
        fields={[
          { name: 'username', label: 'Username', type: 'text', autoComplete: 'username', required: true },
          { name: 'email', label: 'Email Address', type: 'email', autoComplete: 'email', required: true },
          { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', required: true },
          { name: 'confirmPassword', label: 'Confirm Password', type: 'password', autoComplete: 'new-password', required: true },

        ]}
        onSubmit={handleRegister}
        isSubmitting={isPending} 
        submitButtonText="Sign Up"
        linkText="Already have an account? Sign In"
        linkTo="/login"
      />
    </Container>
    <ToastContainer position="bottom-right" autoClose={3000} theme="dark" />
  </Box>
  );
};

export default Register;