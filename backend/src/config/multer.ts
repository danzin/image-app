import multer from "multer";
import { createError } from "../utils/errors";

const storage = multer.diskStorage({ destination: "/tmp/uploads" });

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
