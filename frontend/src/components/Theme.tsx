import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // Primary color (blue)
    },
    secondary: {
      main: '#ff4081', // Secondary color (pink)
    },
    background: {
      default: '#FCFFFC', // Background color (dark)
      paper: '#8eb0ff', // Drawer or Paper background
    },
    text: {
      primary: '#ffffff', // Text color
      secondary: '#3a506b', // Secondary text color
    },
  },
  typography: {
    fontFamily: `'Roboto', 'Helvetica', 'Arial', sans-serif`,
    fontSize: 14,
    h1: {
      fontSize: '2rem',
      '@media (min-width:600px)': {
        fontSize: '2.5rem',
      },
      '@media (min-width:960px)': {
        fontSize: '3rem',
      },
      '@media (min-width:1280px)': {
        fontSize: '3.5rem',
      },
    },
    h2: {
      fontSize: '1.5rem',
      '@media (min-width:600px)': {
        fontSize: '2rem',
      },
      '@media (min-width:960px)': {
        fontSize: '2.5rem',
      },
      '@media (min-width:1280px)': {
        fontSize: '3rem',
      },
    },
    h3: {
      fontSize: '1.2rem',
      '@media (min-width:600px)': {
        fontSize: '1.5rem',
      },
      '@media (min-width:960px)': {
        fontSize: '2rem',
      },
      '@media (min-width:1280px)': {
        fontSize: '2.4rem',
      },
    },
    h4: {
      fontSize: '1.1rem',
      '@media (min-width:600px)': {
        fontSize: '1.3rem',
      },
      '@media (min-width:960px)': {
        fontSize: '1.6rem',
      },
      '@media (min-width:1280px)': {
        fontSize: '1.9rem',
      },
    },
    h5: {
      fontSize: '1rem',
      '@media (min-width:600px)': {
        fontSize: '1.2rem',
      },
      '@media (min-width:960px)': {
        fontSize: '1.4rem',
      },
      '@media (min-width:1280px)': {
        fontSize: '1.6rem',
      },
    },
    h6: {
      fontSize: '0.9rem',
      '@media (min-width:600px)': {
        fontSize: '1.1rem',
      },
      '@media (min-width:960px)': {
        fontSize: '1.3rem',
      },
      '@media (min-width:1280px)': {
        fontSize: '1.5rem',
      },
    },
    body1: {
      fontSize: '0.875rem',
      '@media (min-width:600px)': {
        fontSize: '1rem',
      },
      '@media (min-width:960px)': {
        fontSize: '1.125rem',
      },
      '@media (min-width:1280px)': {
        fontSize: '1.25rem',
      },
    },
    body2: {
      fontSize: '0.75rem',
      '@media (min-width:600px)': {
        fontSize: '0.875rem',
      },
      '@media (min-width:960px)': {
        fontSize: '1rem',
      },
      '@media (min-width:1280px)': {
        fontSize: '1.125rem',
      },
    },
  },
});

export default theme;
