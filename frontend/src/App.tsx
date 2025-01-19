import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import Home from './screens/Home'
import Login from './screens/Login'
import Register from './screens/Register'
import Profile from './screens/Profile'
import Layout from './components/Layout'
import AuthProvider from './context/AuthContext'



function App() {
  return (
  <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="profile" element={<Profile />} />
            {/* <Route path="upload" element={<UploadImage />} />
            <Route path="dashboard" element={<Dashboard />} /> */}
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App