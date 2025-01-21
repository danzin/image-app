import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Menu, X, Search, Bell, ChevronDown, Layout, User, Calendar, Grid, BarChart2, Settings } from 'lucide-react';
import UploadForm from './UploadForm';

const Navbar = () => {
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const navigation = [
    { name: 'Home', icon: Layout, href: '/' },
    { name: 'Profile', icon: User, href: '/profile' },
    { name: 'Gallery', icon: Grid, href: '/gallery' },
    { name: 'Calendar', icon: Calendar, href: '/calendar' },
    { name: 'Analytics', icon: BarChart2, href: '/analytics' },
    { name: 'Settings', icon: Settings, href: '/settings' }
  ];

  return (
    <>
      {/* Sidebar */}
      {/* {isLoggedIn && (
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 transform transition-transform duration-200 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between h-16 px-4 bg-gray-800">
            <Link to="/" className="text-xl font-bold text-white">Peek</Link>
            <button onClick={() => setIsSidebarOpen(false)} className="p-1 text-gray-400 hover:text-white lg:hidden">
              <X size={24} />
            </button>
          </div>
          
          <nav className="mt-5 px-2 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-700 hover:text-white"
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      )} */}

      {/* Top Navigation */}
      <div className={`sticky top-0 z-40 `}>
        <div className="bg-[#333] border-b border-white backdrop-blur-lg bg-opacity-60">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            {isLoggedIn && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className={`${isSidebarOpen ? 'hidden' : 'block'} text-gray-500 lg:hidden`}
              >
                <Menu size={24} />
              </button>
            )}
            
            <div className="flex-1 flex items-center">
              <Link to="/" className="text-xl font-bold">Peek</Link>
            </div>

            <div className="flex-1 flex justify-center">
              {isLoggedIn && (
                <div className="w-full max-w-lg">
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-full px-4 py-2 text-sm text-gray-900 bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="flex-1 flex items-center justify-end space-x-4">
              {isLoggedIn ? (
                <>
                  <button className="p-1 text-gray-400 hover:text-gray-500">
                    <span className="sr-only">Notifications</span>
                    <div className="relative">
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                      <Bell className="w-6 h-6" />
                    </div>
                  </button>

                  <div className="relative">
                    <div className="dropdown dropdown-end">
                      <button className="flex items-center space-x-3" tabIndex={0}>
                        <img
                          className="w-8 h-8 rounded-full"
                          src="https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp"
                          alt="Profile"
                        />
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </button>
                      <ul tabIndex={0} className="dropdown-content menu menu-sm bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow">
                        <li>
                          <Link to="/profile" className="justify-between">
                            Profile
                            <span className="badge">New</span>
                          </Link>
                        </li>
                        <li><a>Settings</a></li>
                        <li><a onClick={openModal}>Upload</a></li>
                        <li>
                          <a onClick={() => {
                            logout();
                            navigate('/');
                          }}>
                            Logout
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn glass">Log In</Link>
                  <Link to="/register" className="btn glass">Register</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <UploadForm onClose={closeModal} />
            <div className="modal-action">
              <button className="btn btn-outline" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;