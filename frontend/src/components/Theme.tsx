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
  },
});

export default theme;
