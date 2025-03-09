import { injectable } from "tsyringe";
import { ICommandHandler } from "../interfaces/command-handler.interface";
import { ICommand } from "../interfaces/command.interface";


@injectable()
export class CommandBus {
  // Registering handlers in a map with command's name as key. 
  private handlers = new Map<string, ICommandHandler<ICommand, any>>(); 

  /**
   * Registers a command handler for a specific command type.
   * Can register any TCommand type that implements the ICommand interface. 
   * TResult is the return type of the command handler
   * @param commandType - The class constructor of the command type.
   * @param handler - The handler responsible for processing the command.
   */
 
  register<TCommand extends ICommand, TResult>(
    // commandType should be a class constructor that can create instances of TCommand
    // new(...args: []) is a constructor signature that takes an array of arguments. 
    commandType: { new(...args: any[]): TCommand}, 

    // An instance of a command handler. 
    // Returns a Promise<TResult> as specified in the ICommandHandler interface.
    handler: ICommandHandler<TCommand, TResult> 
  ) : void
  {
    // Registering the handler in the handlers map. 
    // handler is explicitly cast as ICommandHandler<ICommand, any> to ensure type compatbility within the map. 
    // That way, even if commands have different TCommand and TResult, they can be stored in the map. 
    this.handlers.set(commandType.name, handler as ICommandHandler<ICommand, any>);
  }

  /**
   * Dispatches a command to its corresponding handler.
   * @param command - The command instance to be processed.
   * @returns The result of the command execution.
   * @throws An error if no handler is found for the command.
   */
  async dispatch<TResult>(command: ICommand): Promise<TResult>{
    //.constructor.name retrieves the name of the class that created the command 
    // It guarantees the correct handler is found based on the class name. 
    // 'command' itself has no property 'name'. 
    const handler = this.handlers.get(command.constructor.name); 
    

    if(!handler){
      throw new Error(`No handler found for command ${command.constructor.name}`);
    }

    return handler.execute(command) as Promise<TResult>;
  }

}