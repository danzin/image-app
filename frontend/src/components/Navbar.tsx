import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { styled, alpha } from '@mui/material/styles';
import { useGallery } from '../context/GalleryContext';
import { useMediaQuery, useTheme } from '@mui/material';
import {
  AppBar,
  Box,
  Toolbar,
  IconButton,
  Typography,
  InputBase,
  Button,
  Drawer
} from '@mui/material';
import { Menu as MenuIcon, Search as SearchIcon } from '@mui/icons-material';
import {Tags} from '../components/TagsContainer';
import NotificationBell from './NotificationBell';
import ProfileMenu from './ProfileMenu';
import { useAuth } from '../hooks/context/useAuth';

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(3),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: '20ch',
    },
  },
}));

const Navbar = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const { isProfileView } = useGallery();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

 

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Trim whitespaces and remove empty terms
    const formattedQuery = searchTerm
      .split(' ')
      .map((q) => q.trim()) 
      .filter((q) => q.length > 0) //removes empty terms
      .join(',');
    console.log(`formattedQuery: ${formattedQuery}`)
    if (formattedQuery) {
        navigate(`/results?q=${formattedQuery}`);
    }
    setSearchTerm('')
  };
  

  const toggleDrawer = (open: boolean) => () => {
    setIsDrawerOpen(open);
  };

  return (
    <>
      <AppBar position="sticky" sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>
        <Toolbar>
          {isSmallScreen && !isProfileView && (
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={toggleDrawer(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
              Peek
            </Link>
          </Typography>

          {/** Search */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center' }}>
            <Search>
              <SearchIconWrapper>
                <SearchIcon />
              </SearchIconWrapper>
              <StyledInputBase
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="eg: user tag item"
                inputProps={{ 'aria-label': 'search' }}
              />
            </Search>
          </form>


          {isLoggedIn ? (
            <>
                <NotificationBell />
                <ProfileMenu />
            </>
          ) : (
            <>
              <Button color="inherit" component={Link} to="/login">
                Log In
              </Button>
              <Button color="inherit" component={Link} to="/register">
                Register
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={isDrawerOpen}
        onClose={toggleDrawer(false)}
        PaperProps={{
          sx: { backgroundColor: 'background.paper' },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            width: 250,
            height: '100%',
            p: 2,
            backgroundColor: 'background.secondary',
            color: 'text.secondary',
          }}
          role="presentation"
        >
          <Typography variant="h6" sx={{ mb: 2 }} color="text.secondary">
            Filter by Tags
          </Typography>
          <Tags />
        </Box>
      </Drawer>
    </>
  );
};

export default Navbar;
