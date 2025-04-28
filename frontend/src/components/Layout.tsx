import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import Navbar from './Navbar'; 

const Layout: React.FC = () => {
  return (
    <Box sx={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.default', 
    }}>
      <Navbar />
    
      <Box
        component="main" 
        sx={{
          flex: 1, 
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',

          width: '100%', 
        }}
        >
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;