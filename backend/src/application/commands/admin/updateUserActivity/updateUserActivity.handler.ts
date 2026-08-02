import { inject, injectable } from "tsyringe";
import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import type { IUserWriteRepository } from "@/repositories/interfaces/IUserWriteRepository";
import { asUserPublicId } from "@/types/branded";
import { TOKENS } from "@/types/tokens";
import { UpdateUserActivityCommand } from "./updateUserActivity.command";

@injectable()
export class UpdateUserActivityCommandHandler
  implements ICommandHandler<UpdateUserActivityCommand, void>
{
  constructor(
    @inject(TOKENS.Repositories.UserWrite)
    private readonly userWriteRepository: IUserWriteRepository,
  ) {}

  async execute(command: UpdateUserActivityCommand): Promise<void> {
    await this.userWriteRepository.updateByPublicId(
      asUserPublicId(command.payload.userId),
      {
        $set: {
          lastActive: new Date(),
          lastIp: command.payload.ip,
        },
      },
    );
  }
}
