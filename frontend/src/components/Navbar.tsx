import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/context/useAuth';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  InputBase,
  alpha,
  Box,
  Drawer,
  useTheme,
  useMediaQuery,
  Divider,
  Container,
  Avatar,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { Tags } from '../components/TagsContainer'; 
import NotificationBell from './NotificationBell'; 
import ProfileMenu from './ProfileMenu';


const Navbar = () => {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/results?q=${encodeURIComponent(searchTerm.trim())}`);
      setSearchTerm('');
    }
  };

  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' ||
        (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return;
    }
    setIsDrawerOpen(open);
  };

  const drawerContent = (
    <Box sx={{ width: 280, p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
        Filter by Tags
      </Typography>
      <Divider sx={{ mb: 2, borderColor: 'rgba(99, 102, 241, 0.2)' }} />
      <Tags />
    </Box>
  );

  return (
    <>
      <AppBar 
        position="sticky" 
        sx={{ 
          bgcolor: 'rgba(26, 26, 46, 0.8)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          borderBottom: '1px solid rgba(99, 102, 241, 0.2)'
        }}
      >
        <Container maxWidth="xl">
          <Toolbar sx={{ px: { xs: 0, sm: 2 } }}>
            {/* Mobile Menu Button */}
            {isMobile && (
              <IconButton
                size="large"
                edge="start"
                color="inherit"
                aria-label="open drawer"
                sx={{ mr: 2 }}
                onClick={toggleDrawer(true)}
              >
                <MenuIcon />
              </IconButton>
            )}

            {/* Logo with gradient */}
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: { xs: 1, sm: 0 } }}>
              <Avatar 
                sx={{ 
                  background: 'linear-gradient(45deg, #6366f1, #ec4899)',
                  mr: 1,
                  width: 32,
                  height: 32
                }}
              >
                <CameraAltIcon sx={{ fontSize: 18 }} />
              </Avatar>
              <Typography
                variant="h6"
                noWrap
                component={RouterLink}
                to="/"
                sx={{
                  color: 'transparent',
                  backgroundImage: 'linear-gradient(45deg, #6366f1, #ec4899)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: '1.5rem',
                  display: { xs: 'none', sm: 'block' }
                }}
              >
                Peek
              </Typography>
            </Box>

            {/* Search Bar - Enhanced */}
            <Box 
              component="form" 
              onSubmit={handleSearchSubmit} 
              sx={{ 
                position: 'relative', 
                borderRadius: 3,
                backgroundColor: alpha(theme.palette.common.white, 0.08),
                border: '1px solid rgba(99, 102, 241, 0.3)',
                '&:hover': { 
                  backgroundColor: alpha(theme.palette.common.white, 0.12),
                  borderColor: 'rgba(99, 102, 241, 0.5)'
                },
                '&:focus-within': {
                  borderColor: theme.palette.primary.main,
                  boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`
                },
                marginRight: theme.spacing(2), 
                marginLeft: { xs: 0, sm: 4 },
                width: { xs: '120px', sm: '280px', md: '320px' },
                transition: 'all 0.3s ease'
              }}
            >
              <Box sx={{ 
                padding: theme.spacing(0, 2), 
                height: '100%', 
                position: 'absolute', 
                pointerEvents: 'none', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <SearchIcon sx={{ color: alpha(theme.palette.text.primary, 0.6) }} />
              </Box>
              <InputBase
                placeholder="Search tags/users…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                inputProps={{ 'aria-label': 'search' }}
                sx={{ 
                  color: 'inherit', 
                  width: '100%', 
                  '& .MuiInputBase-input': { 
                    padding: theme.spacing(1.5, 1, 1.5, 0), 
                    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
                    fontSize: '0.95rem'
                  } 
                }}
              />
            </Box>

            {/* Spacer */}
            <Box sx={{ flexGrow: 1 }} />

            {/* Auth & Profile */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {isLoggedIn ? (
                <>
                  <NotificationBell />
                  <ProfileMenu />
                </>
              ) : (
                <>
                  <Button 
                    component={RouterLink} 
                    to="/login" 
                    variant="outlined" 
                    size="small"
                    sx={{
                      borderColor: alpha(theme.palette.primary.main, 0.5),
                      color: theme.palette.primary.light,
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        backgroundColor: alpha(theme.palette.primary.main, 0.1)
                      }
                    }}
                  >
                    Log In
                  </Button>
                  <Button 
                    component={RouterLink} 
                    to="/register" 
                    variant="contained" 
                    size="small"
                    sx={{
                      background: 'linear-gradient(45deg, #6366f1, #8b5cf6)',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #4f46e5, #7c3aed)',
                      }
                    }}
                  >
                    Join Peek
                  </Button>
                </>
              )}
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Drawer - Enhanced */}
      <Drawer
        anchor="left"
        open={isDrawerOpen}
        onClose={toggleDrawer(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 280,
            background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
            borderRight: '1px solid rgba(99, 102, 241, 0.2)'
          }
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
};

export default Navbar;