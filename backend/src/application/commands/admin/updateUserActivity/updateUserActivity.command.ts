import { ICommand } from "@/application/common/interfaces/command.interface";

export interface UpdateUserActivityPayload {
  userId: string;
  ip: string;
}

export class UpdateUserActivityCommand implements ICommand {
  readonly type = "UpdateUserActivityCommand";

  constructor(public readonly payload: UpdateUserActivityPayload) {}
}
