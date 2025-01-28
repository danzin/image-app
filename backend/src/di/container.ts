import 'reflect-metadata';
import { container } from 'tsyringe';
import { Model } from 'mongoose';
import { ConfigOptions, v2 as cloudinary } from 'cloudinary';

// models, repositories, services, controllers, and routes
import User from '../models/user.model';
import Image, { Tag } from '../models/image.model';
import { UserRepository } from '../repositories/user.repository';
import { ImageRepository } from '../repositories/image.repository';
import { TagRepository } from '../repositories/tag.repository';
import { CloudinaryService } from '../services/cloudinary.service';
import { UserService } from '../services/user.service';
import { ImageService } from '../services/image.service';
import { UserController } from '../controllers/user.controller';
import { ImageController } from '../controllers/image.controller';
import { UserRoutes } from '../routes/user.routes';
import { ImageRoutes } from '../routes/image.routes';
import { Server } from '../server/server';
import { UnitOfWork } from '../database/UnitOfWork';

export function setupContainer(): void {
  // Register Models
  container.register('UserModel', { useValue: User });
  container.register('ImageModel', { useValue: Image });
  container.register('TagModel', { useValue: Tag });

  // Register Repositories as singletons
  container.registerSingleton('UnitOfWork', UnitOfWork)
  container.registerSingleton('UserRepository', UserRepository);
  container.registerSingleton('ImageRepository', ImageRepository);
  container.registerSingleton('TagRepository', TagRepository);

  // Register Services as singletons
  container.registerSingleton('CloudinaryService', CloudinaryService);
  container.registerSingleton('UserService', UserService);
  container.registerSingleton('ImageService', ImageService);

  // Register Controllers as singletons
  container.registerSingleton('UserController', UserController);
  container.registerSingleton('ImageController', ImageController);

  // Register Routes as singletons
  container.registerSingleton('UserRoutes', UserRoutes);
  container.registerSingleton('ImageRoutes', ImageRoutes);

  // Register Server
  container.registerSingleton('Server', Server);
  
}
