import express from 'express';
import { ImageController } from '../controllers/image.controller';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import upload from '../config/multer';
import { AuthentitactionMiddleware } from '../middleware/authorization.middleware';


export class ImageRoutes {
  public router: express.Router; 
  private imageController: ImageController;

  constructor(){
    this.router = express.Router();
    this.imageController = new ImageController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post('/upload',
      AuthentitactionMiddleware.auth,
      upload.single('image'), 
      this.imageController.uploadImage.bind(this.imageController)
    );
    
    this.router.get('/', this.imageController.getImages.bind(this.imageController)); 
    this.router.get('/user', AuthentitactionMiddleware.auth, this.imageController.getUserImages.bind(this.imageController))

    this.router.get('/:id', this.imageController.getImageById.bind(this.imageController));
  
  }
}