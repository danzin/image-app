/**
 * JWT Payload structure for authenticated users
 * this represents the claims stored in the JWT token
 */
export interface DecodedUser {
	publicId: string;
	email: string;
	handle: string;
	username: string;
	isAdmin: boolean;
	sid?: string;
	jti?: string;
	ver?: number;
	iat?: number; // issued at (added by JWT)
	exp?: number; // expiration (added by JWT)
}

export interface SessionUserClaims {
	publicId: string;
	email: string;
	handle: string;
	username: string;
	isAdmin: boolean;
}

export interface AuthSessionRecord {
	sid: string;
	publicId: string;
	refreshTokenHash: string;
	createdAt: number;
	lastSeenAt: number;
	ip?: string;
	userAgent?: string;
	status: "active";
}

/**
 * Admin context attached to requests for audit logging
 */
export interface AdminContext {
	adminId: string;
	adminUsername: string;
	timestamp: Date;
	ip?: string;
	userAgent?: string;
}
