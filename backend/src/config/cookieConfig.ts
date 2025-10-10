// Allow explicit override for COOKIE_SECURE=false when running production mode on plain HTTP in local docker
const explicitSecure = process.env.COOKIE_SECURE;
const secureFlag = explicitSecure !== undefined ? explicitSecure === "true" : process.env.NODE_ENV === "production";

export const cookieOptions = {
	httpOnly: true,
	secure: secureFlag,
	sameSite: secureFlag ? ("none" as const) : ("lax" as const),
	maxAge: 1000 * 60 * 60 * 12,
	path: "/",
	...(process.env.NODE_ENV === "production" && process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
};
