import React, { useState, useEffect } from 'react';
import {
    Box, TextField, Button, Paper, CircularProgress,
    Stack,  
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save'; 
import CancelIcon from '@mui/icons-material/Cancel';
import { EditProfileProps, IUser } from '../types';
import { useEditUser } from '../hooks/user/useUsers';

export const EditProfile: React.FC<EditProfileProps> = ({
    onComplete,
    notifySuccess,
    notifyError,
    initialData
}) => {
    // State initialized from initialData
    const [username, setUsername] = useState(initialData?.username || '');
    const [bio, setBio] = useState(initialData?.bio || '');

    useEffect(() => {
      if (initialData) {
        setUsername(initialData.username || '');
        setBio(initialData.bio || '');
      } else {
        setUsername('');
        setBio('');
      }
    }, [initialData]);

    const { mutate: editUserMutation, isPending } = useEditUser();

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!username.trim()) {
        notifyError("Username cannot be empty.");
        return;
      }
      const updateData: Partial<IUser> = {
        username: username.trim(),
        bio: bio.trim(),
      };

      // Call mutation
      editUserMutation(updateData, {
        onSuccess: () => {
          notifySuccess('Profile updated successfully!');
          onComplete(); 
        },
        onError: (error: unknown) => {
          let errorMessage = 'Unknown error';
          if (error && typeof error === 'object' && 'message' in error) {
            errorMessage = (error as { message?: string }).message || errorMessage;
          }
          notifyError(`Update failed: ${errorMessage}`);
        }
      });
    };

  return (
    <Paper sx={{ p: {xs: 2, sm: 3}, width: '100%', bgcolor: 'background.paper' }}>
      {/* Using Box as the form container */}
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={3}>
          <TextField
            fullWidth
            id="edit-username" 
            label="Username"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isPending}
          />
          <TextField
            fullWidth
            id="edit-bio"
            label="Bio"
            name="bio"
            multiline
            rows={4} 
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            disabled={isPending}
            placeholder="Tell us something about yourself..."
            inputProps={{ maxLength: 200 }}
            helperText={`${bio.length}/200`}
          />
          
          {/* Action Buttons */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              onClick={onComplete}
              disabled={isPending}
              startIcon={<CancelIcon />}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isPending}
              startIcon={isPending ? <CircularProgress size={20} color="inherit"/> : <SaveIcon />}
            >
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
};