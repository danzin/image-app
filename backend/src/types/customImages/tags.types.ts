import { Document } from 'mongoose'

export interface ITag extends Document {
  _id: string,
  tag: string;
  count?: number; // Optional because default value
  modifiedAt?: Date; // Optional becasue default value
}