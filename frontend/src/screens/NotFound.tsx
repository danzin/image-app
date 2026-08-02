import { Box, Button, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

const NotFound = () => {
	return (
		<Box
			sx={{
				minHeight: "60vh",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				textAlign: "center",
				px: 3,
			}}
		>
			<Typography variant="h3" fontWeight={800} gutterBottom>
				Page not found
			</Typography>
			<Typography color="text.secondary">
				The page may have moved, or the link may be out of date.
			</Typography>
			<Button
				component={RouterLink}
				to="/"
				variant="contained"
				sx={{ mt: 3, borderRadius: 9999 }}
			>
				Go home
			</Button>
		</Box>
	);
};

export default NotFound;
