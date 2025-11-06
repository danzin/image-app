import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
	palette: {
		mode: "light",
		primary: {
			main: "#d97706",
			light: "#f59e0b",
			dark: "#b45309",
		},
		secondary: {
			main: "#ea580c",
			light: "#fb7185",
			dark: "#dc2626",
		},
		background: {
			default: "#fafaf9",
			paper: "#ffffff",
		},
		text: {
			primary: "#1f2937",
			secondary: "#6b7280",
		},
		divider: "#e5e7eb",
	},
	components: {
		MuiDrawer: {
			styleOverrides: {
				paper: {
					border: "none",
					background: "#ffffff",
				},
			},
		},
		MuiAppBar: {
			styleOverrides: {
				root: {
					boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
					background: "#ffffff",
					color: "#1f2937",
				},
			},
		},

		MuiCard: {
			styleOverrides: {
				root: {
					background: "#ffffff",
					border: "1px solid #e5e7eb",
					borderRadius: 16,
					transition: "all 0.3s ease",
					"&:hover": {
						transform: "translateY(-2px)",
						boxShadow: "0 10px 25px rgba(0, 0, 0, 0.08)",
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
						boxShadow: "0 8px 20px rgba(217, 119, 6, 0.15)",
					},
				},
			},
		},
		MuiChip: {
			styleOverrides: {
				root: {
					borderRadius: 8,
					backgroundColor: "#fef3c7",
					color: "#92400e",
				},
			},
		},
		MuiPaper: {
			styleOverrides: {
				root: {
					backgroundImage: "none",
					background: "#ffffff",
					border: "1px solid #e5e7eb",
				},
			},
		},
	},
	typography: {
		fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
		h4: {
			fontWeight: 700,
			color: "#1f2937",
		},
		h6: {
			fontWeight: 600,
			color: "#1f2937",
		},
	},
});
