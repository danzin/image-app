import express from 'express';
import { ImageController } from '../controllers/image.controller';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import upload from '../config/multer';
import { AuthFactory } from '../middleware/authentication.middleware';
import { inject, injectable } from 'tsyringe';


@injectable()
export class ImageRoutes {
  public router: express.Router; 
  private auth = AuthFactory.bearerToken().handle();

  constructor(@inject('ImageController') private controller: ImageController) {
    this.router = express.Router()
    this.initializeRoutes();
  }


  private initializeRoutes(): void {
   
    //get all images
    this.router.get('/', this.controller.getImages); 

    //returns images uploaded by userId
    this.router.get('/user/:id', this.controller.getUserImages);

    //return images by selected tags
    this.router.get('/search/tags', this.controller.searchByTags);
    
    //returns all tags
    this.router.get('/tags', this.controller.getTags);

    
    //logged in user uploads an image
    this.router.post('/upload', this.auth, upload.single('image'),this.controller.uploadImage);
    
    //logged in deletes an image
    this.router.delete('/:id', this.auth, this.controller.deleteImage);
    
    //returns image by id
    this.router.get('/:id', this.controller.getImageById);
  }
  public getRouter(): express.Router {
      return this.router;
    }
}