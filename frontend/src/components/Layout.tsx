import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const Layout: React.FC = () => {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div className="main-content" style={{ flex: 1, overflow: 'auto' }}> {/* Allow scrolling */}
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;