import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, InputBase, alpha, useTheme } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

const SearchBox: React.FC = () => {
	const navigate = useNavigate();
	const theme = useTheme();
	const [searchTerm, setSearchTerm] = useState("");

	const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (searchTerm.trim()) {
			navigate(`/results?q=${encodeURIComponent(searchTerm.trim())}`);
			setSearchTerm("");
		}
	};

	return (
		<Box
			component="form"
			onSubmit={handleSearchSubmit}
			sx={{
				position: "relative",
				borderRadius: 3,
				backgroundColor: alpha(theme.palette.common.white, 0.08),
				border: "1px solid rgba(99, 102, 241, 0.3)",
				"&:hover": {
					backgroundColor: alpha(theme.palette.common.white, 0.12),
					borderColor: "rgba(99, 102, 241, 0.5)",
				},
				"&:focus-within": {
					borderColor: theme.palette.primary.main,
					boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
				},
				width: "100%",
				transition: "all 0.3s ease",
			}}
		>
			<Box
				sx={{
					padding: theme.spacing(0, 2),
					height: "100%",
					position: "absolute",
					pointerEvents: "none",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<SearchIcon sx={{ color: alpha(theme.palette.text.primary, 0.6) }} />
			</Box>
			<InputBase
				placeholder="Search tags/users…"
				value={searchTerm}
				onChange={(e) => setSearchTerm(e.target.value)}
				inputProps={{ "aria-label": "search" }}
				sx={{
					color: "inherit",
					width: "100%",
					"& .MuiInputBase-input": {
						padding: theme.spacing(1.5, 1, 1.5, 0),
						paddingLeft: `calc(1em + ${theme.spacing(4)})`,
						fontSize: "0.95rem",
					},
				}}
			/>
		</Box>
	);
};

export default SearchBox;
