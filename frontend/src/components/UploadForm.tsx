import React, { useState, useRef } from "react";
import { X, ImagePlus } from "lucide-react";
import { useUploadPost } from "../hooks/posts/usePosts";
import { UploadFormProps } from "../types";

const UploadForm: React.FC<UploadFormProps> = ({ onClose }) => {
	const uploadPostMutation = useUploadPost();
	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<string>("");
	const [body, setBody] = useState<string>("");
	const [tags, setTags] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const MAX_BODY_LENGTH = 250;

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files[0]) {
			const selectedFile = e.target.files[0];
			setFile(selectedFile);

			//image preview
			const reader = new FileReader();
			reader.onload = (e) => {
				setPreview(e.target?.result as string);
			};
			reader.readAsDataURL(selectedFile);
		}
	};

	const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && tagInput.trim() && tags.length < 5) {
			e.preventDefault();
			if (!tags.includes(tagInput.trim())) {
				// Using functional state update to ensure the latest state is used
				// because the tags variable represents the tags from the previous state update, not the
				// most up-to-date state, because react batches state updates and re-renders components
				// Without the functional updater, the tags state represents the tags from the previous update
				setTags((prevTags) => {
					const updatedTags = [...prevTags, tagInput.trim()];
					return updatedTags;
				});
				setTagInput("");
			}
		}
	};

	const removeTag = (tagToRemove: string) => {
		setTags((prevTags) => {
			const updatedTags = prevTags.filter((tag) => tag !== tagToRemove);
			console.log("Updated Tags:", updatedTags); // Logs the new state
			return updatedTags;
		});
		console.log(tags);
	};

	const handleUpload = async () => {
		// Validation: must have either text or image
		if (!file && !body.trim()) {
			alert("Please provide either text content or an image");
			return;
		}

		const formData = new FormData();
		console.log("tags:", JSON.stringify(tags));

		if (file) {
			formData.append("image", file);
		}
		if (body.trim()) {
			formData.append("body", body.trim());
		}
		formData.append("tags", JSON.stringify(tags));
		console.log("formData: ", formData);

		try {
			await uploadPostMutation.mutateAsync(formData);
			console.log("[UploadForm] Post uploaded successfully");
			onClose();
		} catch (error) {
			console.error("[UploadForm] Upload failed:", error);
			// keep modal open on error so user can retry
		}
	};

	return (
		<div className="flex flex-col items-center justify-center w-full max-w-2xl h-4/5 mx-auto p-4">
			{/* Post Content Textarea */}
			<div className="w-full mb-4">
				<label htmlFor="body" className="block text-sm font-medium mb-2">
					What's on your mind? ({body.length}/{MAX_BODY_LENGTH})
				</label>
				<textarea
					id="body"
					value={body}
					onChange={(e) => {
						if (e.target.value.length <= MAX_BODY_LENGTH) {
							setBody(e.target.value);
						}
					}}
					placeholder="Share your thoughts..."
					className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
					rows={4}
					maxLength={MAX_BODY_LENGTH}
				/>
			</div>

			{/* Image Upload Button */}
			<div className="w-full mb-4">
				{!preview ? (
					<button
						onClick={() => fileInputRef.current?.click()}
						className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-blue-600"
					>
						<ImagePlus size={20} />
						<span>Add an image</span>
					</button>
				) : (
					<div className="relative w-full">
						<img src={preview} alt="Preview" className="w-full max-h-64 object-contain rounded-lg border" />
						<button
							onClick={() => {
								setPreview("");
								setFile(null);
								if (fileInputRef.current) fileInputRef.current.value = "";
							}}
							className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg"
						>
							<X size={16} />
						</button>
					</div>
				)}
				<input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
			</div>

			<div className="w-full space-y-4 mt-4">
				<div className="flex flex-col space-y-2">
					<label htmlFor="tags" className="text-sm font-medium">
						Tags ({tags.length}/5):
					</label>
					<input
						id="tags"
						type="text"
						value={tagInput}
						onChange={(e) => setTagInput(e.target.value)}
						onKeyDown={handleTagKeyDown}
						placeholder="Type a tag and press Enter"
						className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						disabled={tags.length >= 5}
					/>
				</div>

				{tags.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{tags.map((tag) => (
							<span
								key={tag}
								className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
							>
								{tag}
								<button onClick={() => removeTag(tag)} className="ml-2 text-blue-600 hover:text-blue-800">
									<X size={14} />
								</button>
							</span>
						))}
					</div>
				)}
			</div>

			<button
				className="mt-6 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
				onClick={handleUpload}
				disabled={
					(!file && !body.trim()) || // Must have at least one
					uploadPostMutation.isPending
				}
			>
				{uploadPostMutation.isPending ? "Uploading..." : "Create Post"}
			</button>

			{uploadPostMutation.isError && <p className="mt-2 text-sm text-red-600">Upload failed. Please try again.</p>}
		</div>
	);
};

export default UploadForm;
