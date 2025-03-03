import { ICommand } from "./command.interface";

/** TCommand is a generic type extending ICommand. It can be any type that implements the ICommand interface. 
 *  TResult is a generic type defaulting to void if no other return type is specified
 *  Default return type of execute is Promise<void>
 */
export interface ICommandHandler<TCommand extends ICommand, TResult = void> {
  execute(command: TCommand): Promise<TResult>;
}