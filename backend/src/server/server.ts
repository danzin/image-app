import express, { Application } from 'express';
import { UserRoutes } from '../routes/user.routes';
import { ImageRoutes } from '../routes/image.routes';
import { UserController } from '../controllers/user.controller';
import { ImageController } from '../controllers/image.controller';
import { UserService } from '../services/user.service';
import { ImageService } from '../services/image.service';
import { UserRepository } from '../repositories/user.repository';
import { ImageRepository } from '../repositories/image.repository';
import { CloudinaryService } from '../services/cloudinary.service';
import User from '../models/user.model';
import Image from '../models/image.model';
import { v2 as cloudinary, ConfigOptions } from 'cloudinary'
export class Server {
  private app: Application;
  private cloudConfig: (boolean | ConfigOptions)
  constructor() {
    this.app = express();
    this.cloudConfig = cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    this.initializeMiddlewares();
    this.initializeDependencies();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    // Add other global middlewares (CORS, etc.)
  }

  private initializeDependencies() {
    // ======================
    // 1. Initialize Repositories
    // ======================
    const userRepository = new UserRepository(User);
    const imageRepository = new ImageRepository(Image);

    // ======================
    // 2. Initialize Cloud Service
    // ======================
    const cloudinaryService = new CloudinaryService(this.cloudConfig as any);

    // ======================
    // 3. Initialize Services
    // ======================
    const userService = new UserService(User, imageRepository, cloudinaryService);
    const imageService = new ImageService(imageRepository, cloudinaryService); //do like userService

    // ======================
    // 4. Initialize Controllers
    // ======================
    const userController = new UserController(userService);
    const imageController = new ImageController(ImageService); // do it like userController

    // ======================
    // 5. Initialize Routes
    // ======================
    new UserRoutes(userController); // Pass app to routes
    new ImageRoutes(imageController);
  }

  private initializeRoutes() {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => res.status(200).json({ status: 'OK' }));
  }

  private initializeErrorHandling() {
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error(err.stack);
      res.status(500).json({ error: 'Internal Server Error' });
    });
  }

  public start(port: number): void {
    this.app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }
}