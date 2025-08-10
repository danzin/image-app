import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
	palette: {
		mode: "dark",
		primary: {
			main: "#6366f1", // Modern indigo
			light: "#818cf8",
			dark: "#4f46e5",
		},
		secondary: {
			main: "#ec4899", // Pink accent
			light: "#f472b6",
			dark: "#db2777",
		},
		background: {
			default: "#0f0f23", // Deep navy
			paper: "#1a1a2e", // Slightly lighter navy
		},
		text: {
			primary: "#f8fafc",
			secondary: "#cbd5e1",
		},
		divider: "#334155",
	},
	components: {
		MuiCard: {
			styleOverrides: {
				root: {
					background: "linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)",
					border: "1px solid #334155",
					borderRadius: 16,
					transition: "all 0.3s ease",
					"&:hover": {
						transform: "translateY(-4px)",
						boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
					},
				},
			},
		},
		MuiButton: {
			styleOverrides: {
				root: {
					borderRadius: 12,
					textTransform: "none",
					fontWeight: 600,
					boxShadow: "none",
					"&:hover": {
						boxShadow: "0 8px 20px rgba(99, 102, 241, 0.3)",
					},
				},
			},
		},
		MuiChip: {
			styleOverrides: {
				root: {
					borderRadius: 8,
				},
			},
		},
		MuiPaper: {
			styleOverrides: {
				root: {
					backgroundImage: "none",
					background: "linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)",
					border: "1px solid rgba(99, 102, 241, 0.1)",
				},
			},
		},
	},
	typography: {
		fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
		h4: {
			fontWeight: 700,
		},
		h6: {
			fontWeight: 600,
		},
	},
});
