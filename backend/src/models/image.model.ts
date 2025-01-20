import mongoose, { Schema} from 'mongoose';
import {IImage, ITag} from '../types'

const imageSchema = new Schema<IImage>({
  userId: { type: String, required: true },
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  tags: {type: [String], default: [], index: true},
  uploadedBy: {type: String, required: true}
});

const tagSchema = new Schema<ITag>({
  tag: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  modifiedAt: {type: Date, default: Date.now}
});

//Update tags every time an image is uploaded
imageSchema.post('save', async function (doc) {
  //Check if tags exist
  if (doc.tags && doc.tags.length > 0) {
    for (let tag of doc.tags) {
      console.log(`Updating tag: ${tag} at ${new Date().toISOString()}`);
      //Write tag if it doesn't exist or increment it if it does
       await Tag.findOneAndUpdate(
        { tag },
        {
          $inc: { count: 1 }, //Increment tag counter
          $set: { modifiedAt: new Date() }, //st modifiedAt for each tag 
        },
        { upsert: true, new: true }
      );
    }
  }
});

//Update tags when image is deleted
//'remove' is decremented so I'm using findOneAndDelete 
imageSchema.pre('findOneAndDelete', async function (next) {
  //Unlike `save` from the function above, `findOneAndDelete` doesn't have direct access to the document it's deleting, 
  //I need to use the `this` context to access the query
  const doc = await this.model.findOne(this.getQuery()); //`this` refers to the query object being executed, this.getQuery() gains access the document itself

  if (doc && doc.tags && doc.tags.length > 0) {
    for (let tag of doc.tags) {
      await Tag.findOneAndUpdate(
        { tag },
        { $inc: { count: -1 } }, 
        { new: true } 
      );

      //If the tag count is 0, remove the tag
      const updatedTag = await Tag.findOne({ tag });
      if (updatedTag && updatedTag.count <= 0) {
        await Tag.deleteOne({ tag }); 
      }
    }
  }
  next();
});



imageSchema.index({ tags: "text" });

const Image = mongoose.model<IImage>('Image', imageSchema);
export const Tag = mongoose.model('Tag', tagSchema);
export default Image;