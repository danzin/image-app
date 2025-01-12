import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const Layout: React.FC = () => {
  return (
    <div>
      <Navbar />
      <div className="main-content grid"> 
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;