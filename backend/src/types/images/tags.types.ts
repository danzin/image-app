import { Document } from 'mongoose'

export interface ITag extends Document {
  tag: string;
  count?: number; // Optional because default value
  modifiedAt?: Date; // Optional becasue default value
}