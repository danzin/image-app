import crypto from "crypto";

const DEFAULT_AVATAR = "";
const DEFAULT_COVER = "";

interface RegistrationInput {
  handle: string;
  username: string;
  email: string;
  password: string;
  avatar?: string;
  cover?: string;
  ip?: string;
}

interface UserPayload {
  handle: string;
  handleNormalized: string;
  username: string;
  email: string;
  password: string;
  avatar: string;
  cover: string;
  registrationIp: string | undefined;
  lastIp: string | undefined;
  lastActive: Date;
  isEmailVerified: boolean;
  emailVerificationToken: string;
  emailVerificationExpires: Date;
}

/**
 * @pattern Factory
 *
 * Centralises all user-creation concerns that were previously inlined
 * in the RegisterUserCommandHandler.  Keeps the handler focused on
 * orchestration (uniqueness check → create → send email → seed bloom).
 */
export class UserFactory {
  static createFromRegistration(input: RegistrationInput): UserPayload {
    const handle = input.handle.trim();
    const username = input.username.trim();
    const email = input.email.trim().toLowerCase();
    const emailVerificationToken = UserFactory.generateVerificationToken();
    const emailVerificationExpires = UserFactory.getVerificationExpiry();

    return {
      handle,
      handleNormalized: handle.toLowerCase(),
      username,
      email,
      password: input.password,
      avatar: input.avatar || DEFAULT_AVATAR,
      cover: input.cover || DEFAULT_COVER,
      registrationIp: input.ip,
      lastIp: input.ip,
      lastActive: new Date(),
      isEmailVerified: false,
      emailVerificationToken,
      emailVerificationExpires,
    };
  }

  private static generateVerificationToken(): string {
    const value = crypto.randomInt(0, 100000);
    return value.toString().padStart(5, "0");
  }

  private static getVerificationExpiry(): Date {
    const ttlMinutes =
      Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES) || 60;
    return new Date(Date.now() + ttlMinutes * 60 * 1000);
  }
}
