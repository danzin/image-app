import React from 'react';
import { useEditUser } from '../api/editUser';
import AuthForm from './AuthForm';
import { ToastContainer, toast } from 'react-toastify';

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
        { name: 'email', type: 'email', placeholder: 'email@example.com' },
        { name: 'username', type: 'username', placeholder: 'username'},
        { name: 'password', type: 'password', placeholder: '********' },
      ]}
      onSubmit={handleEdit}
      submitButtonText="Submit"
      />
    </>
  )
}
