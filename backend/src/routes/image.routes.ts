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

  constructor(
    @inject('ImageController') private controller: ImageController) {
    this.router = express.Router()
    this.initializeRoutes();
  }


  private initializeRoutes(): void {
   
    // Public routes
    this.router.get('/', this.controller.getImages); 

    //returns images uploaded by user using the user object from the request
    this.router.get('/user/:id', this.controller.getUserImages)
    this.router.get('/search/tags', this.controller.searchByTags);
    this.router.get('/tags', this.controller.getTags);

    this.router.get('/:id', this.controller.getImageById);

    // Protected routes group
    const protectedRouter = express.Router();
    this.router.use(protectedRouter); //mount the protectedRouter
    protectedRouter.use(this.auth);
      
    this.router.post('/upload',
        upload.single('image'), 
        this.controller.uploadImage
    );

    this.router.delete('/:id', protectedRouter, this.controller.deleteImage);
    
  }
  public getRouter(): express.Router {
      return this.router;
    }
}