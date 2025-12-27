import { inject, injectable } from "tsyringe";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { ResetPasswordCommand } from "./ResetPasswordCommand";
import { UserRepository } from "../../../../repositories/user.repository";
import { createError } from "../../../../utils/errors";

@injectable()
export class ResetPasswordHandler implements ICommandHandler<ResetPasswordCommand, void> {
	constructor(@inject("UserRepository") private readonly userRepository: UserRepository) {}

	async execute(command: ResetPasswordCommand): Promise<void> {
		const user = await this.userRepository.findByResetToken(command.token);

		if (!user) {
			throw createError("ValidationError", "Invalid or expired reset token");
		}

		await this.userRepository.update(user.id, {
			$set: { password: command.newPassword },
			$unset: { resetToken: 1, resetTokenExpires: 1 },
		});
	}
}
