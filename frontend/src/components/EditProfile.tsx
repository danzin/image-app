import React from 'react'
import { useEditUser } from '../api/editUser';
import AuthForm from './AuthForm';
import { ToastContainer, toast } from 'react-toastify';



export const EditProfile: React.FC = () => {
  const { mutateAsync: editUserMutation } = useEditUser();
  const handleEdit = async (formData: { username: string; email: string; password: string }) => {
  const notifySuccess = () => toast.success("Profile edited!"); 
  const notifyError = (message: string) => toast.error(`Error: ${message}`);
    try {
      console.log("Running handleSubmit");
      await editUserMutation({username: formData.username, email: formData.email, password: formData.password });
      notifySuccess();
    } catch (error: any) {
      notifyError(error.message)
      console.error(error.message || 'An error occurred');
    }
  };
    
  return (
    <>
      <ToastContainer />
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
