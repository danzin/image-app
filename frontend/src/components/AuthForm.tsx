import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Button, Alert, Link as MUILink } from '@mui/material';

interface AuthFormProps<T> {
  title: string;
  fields: { 
    name: keyof T;
    type: string;
    placeholder: string;
    required: boolean;
  }[];
  onSubmit: (formData: T) => void;
  error?: string | null;
  submitButtonText: string;
  linkText?: string;
  linkTo?: string;
  onSuccess?: () => void;
}

const AuthForm = <T extends { [key: string]: string }>({
  title,
  fields,
  onSubmit,
  error,
  submitButtonText,
  linkText,
  linkTo,
  onSuccess,
}: AuthFormProps<T>) => {
  const [formData, setFormData] = useState<T>({} as T);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <Typography variant="h4" component="h1">
          {title}
        </Typography>
        <Paper elevation={3} sx={{ padding: 4, width: { xs: '100%', sm: '400px' } }}>
          <form onSubmit={handleSubmit}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {fields.map((field) => (
              <TextField
                key={field.name as string}
                label={String(field.name)}
                type={field.type}
                placeholder={field.placeholder}
                required={field.required}
                fullWidth
                margin="normal"
                name={field.name as string}
                value={formData[field.name] || ''}
                onChange={handleChange}
              />
            ))}
            <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>
              {submitButtonText}
            </Button>
            {linkText && linkTo && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <MUILink component={RouterLink} to={linkTo} variant="body2" underline="hover">
                  {linkText}
                </MUILink>
              </Box>
            )}
          </form>
        </Paper>
      </Box>
    </Box>
  );
};

export default AuthForm;