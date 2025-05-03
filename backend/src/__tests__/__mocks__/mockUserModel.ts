import { jest } from "@jest/globals";

export class MockUserModel {
  data: any;
  $session = jest.fn().mockReturnThis();
  save = jest.fn().mockImplementation(() => Promise.resolve(this.data));
  constructor(data: any) {
    this.data = data;
  }
}

MockUserModel.prototype.$session = jest.fn().mockReturnThis();
MockUserModel.prototype.save = jest.fn().mockImplementation(function () {
  return Promise.resolve(this.data);
});
