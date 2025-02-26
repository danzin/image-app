import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import Navbar from './Navbar';

const Layout: React.FC = () => {
  
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }} >
      <Navbar />
      <Box className='background'
        sx={{
          flex: 1,
          overflowY: 'auto', 
          display: 'flex',
          flexDirection: 'column',
          px: 3,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;