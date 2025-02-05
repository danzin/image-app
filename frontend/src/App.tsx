import { BrowserRouter as Router, Route, Routes, BrowserRouter } from 'react-router-dom';
import Home from './screens/Home';
import Login from './screens/Login';
import Register from './screens/Register';
import Profile from './screens/Profile';
import Layout from './components/Layout';
import AuthProvider from './context/AuthContext';
import { ThemeProvider } from '@emotion/react';

import { AdminRoute } from './components/AdminRoute';
// import { AdminDashboard } from './screens/Admin';  // Assuming you have an Admin component
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { GalleryProvider } from './context/GalleryContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import theme from './components/Theme';
import { ProtectedRoute } from './components/ProtectedRoute';


function App() {
  const queryClient = new QueryClient();

  return (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <AuthProvider>
          <GalleryProvider>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="profile" element={<ProtectedRoute element={<Profile/>}/>} />
                <Route path="profile/:id" element={<ProtectedRoute element={<Profile/>}/>} />

                {/* <Route path="admin" element={<AdminRoute element={<AdminDashboard />} />} /> */}
                {/* <Route path="upload" element={<UploadImage />} />
                <Route path="dashboard" element={<Dashboard />} /> */}
              </Route>
            </Routes>
          <ReactQueryDevtools initialIsOpen={false} />
          </GalleryProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </BrowserRouter>
  );
}

export default App;