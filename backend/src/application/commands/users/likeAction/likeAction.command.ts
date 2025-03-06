import { ICommand } from "application/common/interfaces/command.interface";

export class LikeActionCommand implements ICommand{
  readonly type = 'LiceCommandAction';

  constructor(
    public readonly userId: string,
    public readonly imageId: string
  ){}
}