import { inject, injectable } from "tsyringe";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { RequestPasswordResetCommand } from "./RequestPasswordResetCommand";
import { UserRepository } from "../../../../repositories/user.repository";
import { createError } from "../../../../utils/errors";
import { Resend } from "resend";
import crypto from "crypto";

@injectable()
export class RequestPasswordResetHandler implements ICommandHandler<RequestPasswordResetCommand, void> {
	private resend: Resend;

	constructor(@inject("UserRepository") private readonly userRepository: UserRepository) {
		this.resend = new Resend(process.env.RESEND_API_KEY);
	}

	async execute(command: RequestPasswordResetCommand): Promise<void> {
		const user = await this.userRepository.findByEmail(command.email);
		if (!user) {
			return;
		}

		// Generate a reset token
		const resetToken = crypto.randomBytes(32).toString("hex");
		const resetTokenExpires = Date.now() + 3600000; // 1 hour

		await this.userRepository.update(user.id, { resetToken, resetTokenExpires });

		try {
			await this.resend.emails.send({
				from: "noreply@ascendance.social",
				to: user.email,
				subject: "Password Reset Request",
				html: `<p>You requested a password reset. Click <a href="${process.env.FRONTEND_URL}/reset-password?token=${resetToken}">here</a> to reset your password.</p>`,
			});
		} catch (error) {
			console.error("Error sending email:", error);
			throw createError("InternalServerError", "Failed to send password reset email");
		}
	}
}
