import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
	palette: {
		mode: "dark", // switches MUI internal logic to dark mode
		primary: {
			main: "#8b5cf6",
			light: "#a78bfa",
			dark: "#7c3aed",
			contrastText: "#ffffff",
		},
		secondary: {
			main: "#71767b",
		},
		background: {
			default: "#000000",
			paper: "#16181c",
		},
		text: {
			primary: "#e7e9ea",
			secondary: "#71767b",
		},
		divider: "#2f3336",
	},
	typography: {
		fontFamily: '"Open Sans", "Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"',
		allVariants: {
			color: "#e7e9ea",
		},
		h1: {
			fontFamily: '"Montserrat", "sans-serif"',
			fontWeight: 800,
		},
		h2: {
			fontFamily: '"Montserrat", "sans-serif"',
			fontWeight: 800,
		},
		h3: {
			fontFamily: '"Montserrat", "sans-serif"',
			fontWeight: 700,
		},
		h4: {
			fontFamily: '"Montserrat", "sans-serif"',
			fontWeight: 700,
			letterSpacing: "-0.5px",
		},
		h5: {
			fontFamily: '"Montserrat", "sans-serif"',
			fontWeight: 700,
		},
		h6: {
			fontFamily: '"Montserrat", "sans-serif"',
			fontWeight: 600,
		},
		button: {
			fontFamily: '"Montserrat", "sans-serif"',
			textTransform: "none",
			fontWeight: 700,
		},
	},
	components: {
		MuiCssBaseline: {
			styleOverrides: {
				body: {
					backgroundColor: "#000000",
					scrollbarWidth: "thin",
				},
			},
		},

		MuiDrawer: {
			styleOverrides: {
				paper: {
					backgroundColor: "#000000",
					borderRight: "1px solid #2f3336",
					backgroundImage: "none",
				},
			},
		},

		MuiAppBar: {
			styleOverrides: {
				root: {
					backgroundColor: "rgba(0, 0, 0, 0.65)", // Semi-transparent
					backdropFilter: "blur(12px)",
					borderBottom: "1px solid #2f3336",
					boxShadow: "none",
					color: "#e7e9ea",
					backgroundImage: "none",
				},
			},
		},

		MuiCard: {
			styleOverrides: {
				root: {
					backgroundColor: "transparent",
					borderBottom: "1px solid #2f3336",
					border: "none",
					borderRadius: 0,
					backgroundImage: "none",
					boxShadow: "none",
					"&:hover": {
						backgroundColor: "rgba(255, 255, 255, 0.03)",
					},
				},
			},
		},

		MuiDialog: {
			styleOverrides: {
				paper: {
					backgroundColor: "#000000",
					border: "1px solid #2f3336",
					borderRadius: 16,
					backgroundImage: "none",
				},
			},
		},

		MuiMenu: {
			styleOverrides: {
				paper: {
					backgroundColor: "#000000",
					border: "1px solid #2f3336",
					borderRadius: 12,
					backgroundImage: "none",
					boxShadow: "0px 8px 24px rgba(255, 255, 255, 0.1)",
				},
			},
		},

		MuiButton: {
			styleOverrides: {
				root: {
					borderRadius: 9999,
					textTransform: "none",
					fontWeight: 700,
					boxShadow: "none",
				},
				containedPrimary: {
					borderColor: "#536471",
					color: "#e7e9ea",

					"&:hover": {
						backgroundColor: "#8b5cf6",
						boxShadow: "none",
					},
				},
				outlined: {
					borderColor: "#536471",
					color: "#e7e9ea",
					"&:hover": {
						backgroundColor: "rgba(231, 233, 234, 0.1)",
						borderColor: "#536471",
					},
				},
			},
		},
		MuiIconButton: {
			styleOverrides: {
				root: {
					color: "#71767b",
					"&:hover": {
						backgroundColor: "white",
						color: "#8b5cf6",
					},
				},
			},
		},

		MuiOutlinedInput: {
			styleOverrides: {
				root: {
					borderRadius: 4,
					"& .MuiOutlinedInput-notchedOutline": {
						borderColor: "#2f3336",
					},
					"&:hover .MuiOutlinedInput-notchedOutline": {
						borderColor: "#71767b",
					},
					"&.Mui-focused .MuiOutlinedInput-notchedOutline": {
						borderColor: "#8b5cf6",
					},
					color: "#e7e9ea",
				},
			},
		},

		MuiInputLabel: {
			styleOverrides: {
				root: {
					color: "#71767b",
					"&.Mui-focused": {
						color: "#d97706",
					},
				},
			},
		},

		MuiChip: {
			styleOverrides: {
				root: {
					borderRadius: 9999,
					backgroundColor: "transparent",
					border: "1px solid #2f3336",
					color: "#71767b",
					"&:hover": {
						backgroundColor: "rgba(231, 233, 234, 0.1)",
					},
				},
				filled: {
					backgroundColor: "#2f3336",
					border: "none",
					color: "#e7e9ea",
				},
			},
		},
	},
});
