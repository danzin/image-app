import express from 'express';
import { ImageController } from '../controllers/image.controller';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import upload from '../config/multer';
import { AuthentitactionMiddleware } from '../middleware/authorization.middleware';
import { SearchController } from '../controllers/search.controller';

export class SearchRoutes {
  public router: express.Router; 
  private searchController: SearchController;

   constructor(){
      this.router = express.Router();
      this.searchController = new SearchController();
      this.initializeRoutes();
    }
 
    private initializeRoutes(): void {

      this.router.get('/', this.searchController.searchAll.bind(this.searchController));

    }



}

