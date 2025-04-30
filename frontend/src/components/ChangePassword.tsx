import React, { useState } from 'react';
import {
    Box, TextField, Button, Paper, CircularProgress, Stack, Typography, Alert, IconButton, InputAdornment
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useChangePassword } from '../hooks/user/useUsers'; 
import { ChangePasswordProps } from '../types';



export const ChangePassword: React.FC<ChangePasswordProps> = ({
  onComplete,
  notifySuccess,
  notifyError
}) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [error, setError] = useState<string | null>(null); 

    const { mutate: changePasswordMutation, isPending } = useChangePassword();

    const handleClickShowPassword = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
      setter((show) => !show);
    };
    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault(); 
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setError(null); 
      
      //TODO: Use zod
      if (!currentPassword || !newPassword || !confirmPassword) {
        setError("All fields are required.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("New passwords do not match.");
        return;
      }
        if (newPassword.length < 8) { 
        setError("New password must be at least 8 characters long.");
        return;
      }
        if (newPassword === currentPassword) {
        setError("New password cannot be the same as the current one.");
        return;
      }

      changePasswordMutation({ currentPassword, newPassword }, {
        onSuccess: () => {
          notifySuccess("Password changed successfully!");
          onComplete();
        },
        onError: (err: any) => {
          // Use error from backend if available, otherwise generic
          const backendError = err?.message || 'Failed to change password. Please try again.';
          setError(backendError); // Show error in the form
          notifyError(backendError); // Also show toast
        }
      });
    };

    return (
      <Paper sx={{ p: { xs: 2, sm: 3 }, width: '100%', bgcolor: 'background.paper' }}>
        <Typography variant="h6" gutterBottom>Change Password</Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          <Stack spacing={3}>
            {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
            <TextField
              required
              fullWidth
              name="currentPassword"
              label="Current Password"
              type={showCurrentPassword ? 'text' : 'password'}
              id="currentPassword"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isPending}
              InputProps={{
                endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => handleClickShowPassword(setShowCurrentPassword)}
                    onMouseDown={handleMouseDownPassword}
                    edge="end"
                  >
                    {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
                ),
                }}
            />
            <TextField
              required
              fullWidth
              name="newPassword"
              label="New Password"
              type={showNewPassword ? 'text' : 'password'}
              id="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isPending}
              helperText="Must be at least 8 characters"
              InputProps={{ 
                endAdornment: (
                  <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => handleClickShowPassword(setShowNewPassword)}
                    onMouseDown={handleMouseDownPassword}
                    edge="end"
                  >
                    {showNewPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
                ),
              }}
            />
            <TextField
              required
              fullWidth
              name="confirmPassword"
              label="Confirm New Password"
              type={showNewPassword ? 'text' : 'password'} // Use same visibility state as New Password
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isPending}
              error={newPassword !== confirmPassword && confirmPassword.length > 0} // Show error if passwords don't match
              helperText={newPassword !== confirmPassword && confirmPassword.length > 0 ? "Passwords do not match" : ""}
          />

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
                {isPending ? 'Saving...' : 'Change Password'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>
  );
};