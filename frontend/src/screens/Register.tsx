import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegister } from '../api/register';
import AuthForm from '../components/AuthForm';

const Login: React.FC = () => {
  const { mutateAsync: registerMutation } = useRegister();
  const navigate = useNavigate();

  const handleRegister = async (formData: { username: string; email: string; password: string }) => {
    try {
      await registerMutation({username: formData.username, email: formData.email, password: formData.password});
      navigate('/login');
    } catch (error: any) {
      console.error('Registration failed:', error.message);
    }
  };

  return (
    <AuthForm 
    title="Register"
    fields={[
      { name: 'email', type: 'email', placeholder: 'email@example.com' },
      { name: 'username', type: 'username', placeholder: 'username'},
      { name: 'password', type: 'password', placeholder: '********' },
    ]}
    onSubmit={handleRegister}
    submitButtonText="Register"
    linkText="Already have an account?"
    linkTo="/login"
    />
  );
};

export default Login;