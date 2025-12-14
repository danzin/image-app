import multer from "multer";
import fs from "fs";
import { createError } from "../utils/errors";

const tmpDir = "/tmp/uploads";
if (!fs.existsSync(tmpDir)) {
	fs.mkdirSync(tmpDir, { recursive: true });
}

const storage = multer.diskStorage({ destination: tmpDir });

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
	const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
	if (allowedMimeTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(createError("ValidationError", "Invalid file type. Only jpg, jpeg, png, and webp are allowed."));
	}
};

const upload = multer({
	storage,
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB
	},
	fileFilter,
});

export default upload;
