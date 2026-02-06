import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "/.env") });

export const config = {
	port: process.env.PORT || 8000,
	backendUrl: process.env.BACKEND_MONOLITH_URL || "http://localhost:3000",
	rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 15000,
	rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
};
