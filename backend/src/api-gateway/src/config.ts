import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 8000,
  backendUrl: process.env.BACKEND_MONOLITH_URL || "http://localhost:3000",
};
