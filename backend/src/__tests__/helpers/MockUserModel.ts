import { Types, ClientSession } from "mongoose";
import sinon, { SinonStub } from "sinon";
import { IUser } from "../../types";

export class MockUserModel {
  static findOneAndUpdate = sinon.stub();
  static findOne = sinon.stub();
  static findByIdAndUpdate = sinon.stub();
  static find = sinon.stub();
  static countDocuments = sinon.stub();

  public _id: Types.ObjectId;
  public save: SinonStub;
  public $session: SinonStub;

  constructor(data: Partial<IUser>) {
    Object.assign(this, data, { _id: data._id || new Types.ObjectId() });
    this.save = sinon.stub().resolves(this);
    this.$session = sinon.stub().returns(this);
  }
}
