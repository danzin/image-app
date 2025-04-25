import { createTheme, Theme, alpha } from '@mui/material/styles';
import { ChipProps } from '@mui/material/Chip';
const darkPalette = {
  primary: {
    main: '#90caf9', // Lighter blue for dark mode
  },
  secondary: {
    main: '#f48fb1', // Lighter pink for dark mode
  },
  background: {
    default: '#121212', // Standard dark background
    paper: '#1e1e1e',   // Slightly lighter background for surfaces like cards, drawers
  },
  text: {
    primary: '#ffffff', // White text
    secondary: '#b0bec5', // Lighter gray for secondary text
  },
  divider: 'rgba(255, 255, 255, 0.12)', // Subtle white divider
  error: {
    main: '#f44336', // Standard error red
  },
  warning: {
    main: '#ffa726', // Standard warning orange
  },
  info: {
    main: '#29b6f6', // Standard info blue
  },
  success: {
    main: '#66bb6a', // Standard success green
  },
};
const lightPalette = {
 
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
}


const theme = createTheme({
  palette: {
    mode: 'dark',
    ...darkPalette,
  },
  typography: {
    fontFamily: `'Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'`,
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
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
    MuiChip: {
      styleOverrides: {
        root: ({ ownerState, theme: currentTheme }: { ownerState: ChipProps; theme: Theme }) => ({
          margin: currentTheme.spacing(0.5),
          transition: 'background-color 0.2s ease-in-out, color 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: ownerState.variant === 'filled' ? currentTheme.palette.action.hover : 'rgba(255, 255, 255, 0.08)', // Adjusted hover transparency
          },
          ...(ownerState.variant === 'outlined' && {
             borderColor: currentTheme.palette.divider,
          }),
        }),
        colorPrimary: ({ theme: currentTheme }: { theme: Theme }) => ({

            backgroundColor: currentTheme.palette.primary.main,
            color: currentTheme.palette.getContrastText(currentTheme.palette.primary.main),
            '&:hover': {
                backgroundColor: currentTheme.palette.primary.dark,
            },
            '&.MuiChip-outlined': {
                 borderColor: alpha(currentTheme.palette.primary.main, 0.7), 
            },
        }),
      },
    },
  },
});

export default theme;
