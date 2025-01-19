import mongoose, { Schema} from 'mongoose';
import {IImage} from '../types'

const imageSchema = new Schema<IImage>({
  userId: { type: String, required: true },
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  tags: {type: [String], default: []}
});

const Image = mongoose.model<IImage>('Image', imageSchema);

export default Image;