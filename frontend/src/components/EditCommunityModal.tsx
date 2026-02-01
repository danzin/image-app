import React, { useState, useRef } from "react";
import {
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	TextField,
	Box,
	Avatar,
	IconButton,
	Typography,
	CircularProgress,
} from "@mui/material";
import { CameraAlt as CameraIcon, Close as CloseIcon } from "@mui/icons-material";
import { ICommunity, UpdateCommunityDTO } from "../types";
import { useUpdateCommunity } from "../hooks/communities/useCommunity";

interface EditCommunityModalProps {
	open: boolean;
	onClose: () => void;
	community: ICommunity;
}

const EditCommunityModal: React.FC<EditCommunityModalProps> = ({ open, onClose, community }) => {
	const [name, setName] = useState(community.name);
	const [description, setDescription] = useState(community.description);
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
	const [coverPreview, setCoverPreview] = useState<string | null>(null);
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [coverFile, setCoverFile] = useState<File | null>(null);

	const avatarInputRef = useRef<HTMLInputElement>(null);
	const coverInputRef = useRef<HTMLInputElement>(null);

	const { mutate: updateCommunity, isPending } = useUpdateCommunity();

	const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setAvatarFile(file);
			const reader = new FileReader();
			reader.onloadend = () => setAvatarPreview(reader.result as string);
			reader.readAsDataURL(file);
		}
	};

	const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setCoverFile(file);
			const reader = new FileReader();
			reader.onloadend = () => setCoverPreview(reader.result as string);
			reader.readAsDataURL(file);
		}
	};

	const handleSubmit = () => {
		const updates: UpdateCommunityDTO = {};
		if (name !== community.name) updates.name = name;
		if (description !== community.description) updates.description = description;
		if (avatarFile) updates.avatar = avatarFile;
		if (coverFile) updates.coverPhoto = coverFile;

		if (Object.keys(updates).length === 0) {
			onClose();
			return;
		}

		updateCommunity(
			{ communityId: community.publicId, updates },
			{
				onSuccess: () => {
					onClose();
				},
			},
		);
	};

	const getAvatarUrl = () => {
		if (avatarPreview) return avatarPreview;
		if (!community.avatar) return undefined;
		return community.avatar.startsWith("http") ? community.avatar : `/api/${community.avatar}`;
	};

	const getCoverUrl = () => {
		if (coverPreview) return coverPreview;
		if (!community.coverPhoto) return undefined;
		return community.coverPhoto.startsWith("http") ? community.coverPhoto : `/api/${community.coverPhoto}`;
	};

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				Edit Community
				<IconButton onClick={onClose} size="small">
					<CloseIcon />
				</IconButton>
			</DialogTitle>

			<DialogContent>
				{/* Cover Photo */}
				<Box
					sx={{
						position: "relative",
						height: 150,
						bgcolor: "grey.800",
						borderRadius: 2,
						mb: 6,
						overflow: "hidden",
						backgroundImage: getCoverUrl()
							? `url(${getCoverUrl()})`
							: "linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)",
						backgroundSize: "cover",
						backgroundPosition: "center",
					}}
				>
					<IconButton
						sx={{
							position: "absolute",
							right: 8,
							bottom: 8,
							bgcolor: "rgba(0,0,0,0.6)",
							"&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
						}}
						onClick={() => coverInputRef.current?.click()}
					>
						<CameraIcon />
					</IconButton>
					<input ref={coverInputRef} type="file" accept="image/*" hidden onChange={handleCoverChange} />
				</Box>

				{/* Avatar */}
				<Box sx={{ position: "relative", width: 100, mt: -10, ml: 2, mb: 2 }}>
					<Avatar
						src={getAvatarUrl()}
						sx={{
							width: 100,
							height: 100,
							border: "4px solid",
							borderColor: "background.paper",
							bgcolor: "primary.main",
							fontSize: "2.5rem",
						}}
					>
						{community.name.charAt(0).toUpperCase()}
					</Avatar>
					<IconButton
						sx={{
							position: "absolute",
							right: -8,
							bottom: 0,
							bgcolor: "primary.main",
							"&:hover": { bgcolor: "primary.dark" },
							width: 32,
							height: 32,
						}}
						onClick={() => avatarInputRef.current?.click()}
					>
						<CameraIcon sx={{ fontSize: 16 }} />
					</IconButton>
					<input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
				</Box>

				<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
					Click on the icons to change the avatar or cover photo
				</Typography>

				<TextField
					label="Community Name"
					fullWidth
					value={name}
					onChange={(e) => setName(e.target.value)}
					sx={{ mb: 2 }}
				/>

				<TextField
					label="Description"
					fullWidth
					multiline
					rows={3}
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>
			</DialogContent>

			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button onClick={onClose} disabled={isPending}>
					Cancel
				</Button>
				<Button
					variant="contained"
					onClick={handleSubmit}
					disabled={isPending}
					startIcon={isPending ? <CircularProgress size={16} /> : null}
				>
					{isPending ? "Saving..." : "Save Changes"}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default EditCommunityModal;
