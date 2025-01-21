import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './screens/Home';
import Login from './screens/Login';
import Register from './screens/Register';
import Profile from './screens/Profile';
import Layout from './components/Layout';
import AuthProvider from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { AdminDashboard } from './screens/Admin';  // Assuming you have an Admin component
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="profile" element={<ProtectedRoute element={<Profile />} />} />
            <Route path="admin" element={<AdminRoute element={<AdminDashboard />} />} />
            {/* <Route path="upload" element={<UploadImage />} />
            <Route path="dashboard" element={<Dashboard />} /> */}
          </Route>
        </Routes>
      </Router>
      <ReactQueryDevtools initialIsOpen={false} />

    </AuthProvider>
  );
}

export default App;
