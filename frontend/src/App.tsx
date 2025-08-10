import { Route, Routes, BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import Home from './screens/Home';
import Login from './screens/Login';
import Register from './screens/Register';
import Profile from './screens/Profile';
import Layout from './components/Layout';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { GalleryProvider } from './context/GalleryContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from './theme/theme';

import SearchResults from './screens/SearchResults';
import { SocketProvider } from './context/Socket/SocketProvider';
import AuthProvider from './context/Auth/AuthProvider';
import ImageView from './screens/ImageView';


function App() {
  const queryClient = new QueryClient();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SocketProvider>
              <GalleryProvider>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="login" element={<Login />} />
                    <Route path="register" element={<Register />} />
                    <Route path="profile/:id" element={<Profile/>} />
                    <Route path="/results" element={<SearchResults />} />
                    <Route path="images/:id" element={<ImageView />} />
                  </Route>
                </Routes>
                <ReactQueryDevtools initialIsOpen={false} />
              </GalleryProvider>
            </SocketProvider>
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;