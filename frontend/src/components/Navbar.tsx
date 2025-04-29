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

} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
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
    const formattedQuery = searchTerm
      .split(' ')
      .map((q) => q.trim())
      .filter((q) => q.length > 0)
      .join(',');
    if (formattedQuery) {
      navigate(`/results?q=${formattedQuery}`);
    }
    setSearchTerm('');
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
    <Box
      sx={{ width: 250, pt: 2 }} 
      role="presentation"

    >
      <Typography variant="h6" sx={{ px: 2, mb: 1 }}>Filter by Tags</Typography>
      <Divider />
      <Box sx={{px: 1, pt: 1}}> 
        <Tags /> 
      </Box>
    </Box>
  );

  return (
    <>
      <AppBar position="sticky" sx={{ bgcolor: 'background.paper', boxShadow: 1 }}>
        <Toolbar>
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

          {/* Logo */}
          <Typography
            variant="h6"
            noWrap
            component={RouterLink}
            to="/"
            sx={{
              flexGrow: 1,
              color: 'text.primary',
              textDecoration: 'none',
              fontWeight: 'bold',
              display: { xs: 'none', sm: 'block' }
            }}
          >
            Peek
          </Typography>

          {/* Search Bar */}
          <Box component="form" onSubmit={handleSearchSubmit} sx={{ position: 'relative', borderRadius: theme.shape.borderRadius, backgroundColor: alpha(theme.palette.common.white, 0.15), '&:hover': { backgroundColor: alpha(theme.palette.common.white, 0.25) }, marginRight: theme.spacing(2), marginLeft: 0, width: { xs: '150px', sm: '250px' } }}>
            <Box sx={{ padding: theme.spacing(0, 2), height: '100%', position: 'absolute', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SearchIcon sx={{color: 'text.secondary'}} />
            </Box>
            <InputBase
              placeholder="Search tags/users…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              inputProps={{ 'aria-label': 'search' }}
              sx={{ color: 'inherit', width: '100%', '& .MuiInputBase-input': { padding: theme.spacing(1, 1, 1, 0), paddingLeft: `calc(1em + ${theme.spacing(4)})` } }}
            />
          </Box>

          {/* Spacer to push auth buttons to the right */}
          <Box sx={{ flexGrow: {xs: 1, sm: 0} }} />


          {/* Auth & Profile */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isLoggedIn ? (
              <>
                <NotificationBell />
                <ProfileMenu />
              </>
            ) : (
              <>
                <Button component={RouterLink} to="/login" color="inherit" variant="outlined" size="small">
                  Log In
                </Button>
                <Button component={RouterLink} to="/register" variant="contained" size="small">
                  Register
                </Button>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Drawer for Mobile */}
      <Drawer
        anchor="left"
        open={isDrawerOpen}
        onClose={toggleDrawer(false)}
        PaperProps={{ sx: { bgcolor: 'background.paper' }}}
      >
        {drawerContent}
      </Drawer>
    </>
  );
};

export default Navbar;