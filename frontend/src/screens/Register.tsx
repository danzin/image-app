import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegister } from '../hooks/useUserRegister';
import AuthForm from '../components/AuthForm';
import { ToastContainer, toast } from 'react-toastify';

const Login: React.FC = () => {
  const { mutateAsync: registerMutation } = useRegister();
  const navigate = useNavigate();

  const notifySuccess = () => toast.success("Registration successful!"); 
  const notifyError = (message: string) => toast.error(`Registration failed: ${message}`);

  
  const handleRegister = async (formData: { username: string; email: string; password: string }) => {
    try {
      await registerMutation({username: formData.username, email: formData.email, password: formData.password});
      notifySuccess()
      setTimeout(() => navigate('/login'), 1500)
    } catch (error: any) {
      notifyError(error.message)
      console.error('Registration failed:', error.message);
    }
  };
  
  return (
    <>
      <AuthForm 
      title="Register"
      fields={[
        { name: 'email', type: 'email', placeholder: 'email@example.com', required: true },
        { name: 'username', type: 'username', placeholder: 'username', required: true},
        { name: 'password', type: 'password', placeholder: '********', required: true },
      ]}
      onSubmit={handleRegister}
      submitButtonText="Register"
      linkText="Already have an account?"
      linkTo="/login"
      />
      <ToastContainer />

    </>
  );
};

export default Login;