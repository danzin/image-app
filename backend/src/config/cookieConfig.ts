export const cookieOptions = {
  httpOnly: true, // not accessible via client-side JS
  secure: process.env.NODE_ENV === 'production', // only over HTTPS in production
  sameSite: process.env.NODE_ENV === "production" ? "none" as 'none': "lax" as 'lax' ,
  maxAge: 1000 * 60 * 60 * 24, // 24hours
  path: "/"
};