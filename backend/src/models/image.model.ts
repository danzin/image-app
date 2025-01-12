import mongoose, { Schema, Document } from 'mongoose';

export interface IImage extends Document {
  userId: string;
  url: string;
  publicId: string;
  createdAt: Date;
}

const imageSchema = new Schema<IImage>({
  userId: { type: String, required: true },
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Image = mongoose.model<IImage>('Image', imageSchema);

export default Image;