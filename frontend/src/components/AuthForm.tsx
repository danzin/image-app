import React, { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
	Box,
	Paper,
	Typography,
	TextField,
	Button,
	Alert,
	Link as MUILink,
	Stack,
	InputAdornment,
	IconButton,
	CircularProgress,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { AuthFormProps } from "../types";

const AuthForm = <T extends Record<string, string>>({
	title,
	fields,
	onSubmit,
	isSubmitting = false,
	error,
	submitButtonText,
	linkText,
	linkTo,
	initialValues = {},
}: AuthFormProps<T>) => {
	const [formData, setFormData] = useState<Record<keyof T, string>>(() =>
		fields.reduce(
			(acc, field) => {
				acc[field.name] = initialValues[field.name] ?? "";
				return acc;
			},
			{} as Record<keyof T, string>,
		),
	);

	const [showPassword, setShowPassword] = useState(false);
	const [formError, setFormError] = useState<string | null>(error || null);

	// Update local error if prop changes
	useEffect(() => {
		setFormError(error || null);
	}, [error]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prevData) => ({ ...prevData, [name]: value as T[keyof T] }));
		setFormError(null);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setFormError(null);
		if ("confirmPassword" in formData) {
			if (formData.confirmPassword !== formData.password) {
				setFormError("Passwords do not match");
				return;
			}
		}
		onSubmit(formData as T);
	};

	const handleClickShowPassword = () => setShowPassword((show) => !show);
	const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
	};

	return (
		<Paper
			elevation={0}
			sx={{
				p: { xs: 2, sm: 3, md: 4 },
				width: "100%",
				bgcolor: "transparent",
				border: "1px solid",
				borderColor: "divider",
				borderRadius: 2,
			}}
		>
			<Typography component="h1" variant="h5" align="center" sx={{ mb: 3, color: "text.primary" }}>
				{title}
			</Typography>
			<Box component="form" onSubmit={handleSubmit} noValidate>
				<Stack spacing={2}>
					{formError && (
						<Alert severity="error" onClose={() => setFormError(null)}>
							{formError}
						</Alert>
					)}

					{fields.map((field) => (
						<TextField
							key={field.name as string}
							variant="outlined"
							required={field.required}
							fullWidth
							id={field.name as string}
							label={field.label}
							name={field.name as string}
							type={field.type === "password" ? (showPassword ? "text" : "password") : field.type}
							autoComplete={field.autoComplete}
							value={formData[field.name] || ""}
							onChange={handleChange}
							disabled={isSubmitting}
							InputProps={
								field.type === "password"
									? {
											endAdornment: (
												<InputAdornment position="end">
													<IconButton
														aria-label="toggle password visibility"
														onClick={handleClickShowPassword}
														onMouseDown={handleMouseDownPassword}
														edge="end"
														disabled={isSubmitting}
													>
														{showPassword ? <VisibilityOff /> : <Visibility />}
													</IconButton>
												</InputAdornment>
											),
										}
									: undefined
							}
						/>
					))}
					<Button
						type="submit"
						fullWidth
						variant="contained"
						color="primary"
						disabled={isSubmitting}
						sx={{ mt: 2, mb: 1, py: 1.5 }}
					>
						{isSubmitting ? <CircularProgress size={24} color="inherit" /> : submitButtonText}
					</Button>

					{linkText && linkTo && (
						<Typography variant="body2" align="center">
							<MUILink component={RouterLink} to={linkTo} variant="body2" underline="hover" color="secondary">
								{linkText}
							</MUILink>
						</Typography>
					)}
				</Stack>
			</Box>
		</Paper>
	);
};

export default AuthForm;
