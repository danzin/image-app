import { IQuery } from "application/common/interfaces/query.interface";


export class GetMeQuery implements IQuery {

  readonly type = 'GetMeQuery';

  constructor(public readonly userId: string){}


}

