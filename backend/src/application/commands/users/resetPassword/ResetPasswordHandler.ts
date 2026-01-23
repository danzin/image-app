import { inject, injectable } from "tsyringe";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { ResetPasswordCommand } from "./ResetPasswordCommand";
import { createError } from "../../../../utils/errors";
import { IUserReadRepository, IUserWriteRepository } from "../../../../repositories/interfaces";

@injectable()
export class ResetPasswordHandler implements ICommandHandler<ResetPasswordCommand, void> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("UserWriteRepository") private readonly userWriteRepository: IUserWriteRepository,
	) {}

	async execute(command: ResetPasswordCommand): Promise<void> {
		const user = await this.userReadRepository.findByResetToken(command.token);

		if (!user) {
			throw createError("ValidationError", "Invalid or expired reset token");
		}

		await this.userWriteRepository.update(user.id, {
			$set: { password: command.newPassword },
			$unset: { resetToken: 1, resetTokenExpires: 1 },
		});
	}
}
