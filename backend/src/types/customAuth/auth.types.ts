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
	iat?: number; // issued at (added by JWT)
	exp?: number; // expiration (added by JWT)
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
