import React from 'react';
import AuthForm from './AuthForm';
import { useEditUser } from '../hooks/useUsers';

interface EditProfileProps {
  onComplete: () => void;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void
}

export const EditProfile: React.FC<EditProfileProps> = ({ onComplete, notifySuccess, notifyError }) => {
  const { mutateAsync: editUserMutation } = useEditUser();
  const handleEdit = async (formData: { username: string; email: string; password: string }) => {
    try {
      console.log("Running handleSubmit");
      await editUserMutation({username: formData.username, email: formData.email, password: formData.password });
      notifySuccess('Profile edited!');
      onComplete()
    } catch (error: any) {
      notifyError(error.message)
      console.error(error.message || 'An error occurred');
    }
  };
    
  return (
    <>
      
      <AuthForm 
      title="Edit profile"
      fields={[
        { name: 'email', type: 'email', placeholder: 'email@example.com', required: false },
        { name: 'username', type: 'username', placeholder: 'username', required: false},
        { name: 'password', type: 'password', placeholder: '********', required: false },
      ]}
      onSubmit={handleEdit}
      submitButtonText="Submit"
      />
    </>
  )
}
