import 'reflect-metadata';
import { container } from 'tsyringe';

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
import { SearchService } from '../services/search.service';
import { SearchController } from '../controllers/search.controller';
import { FollowService } from '../services/follow.service';
import Follow from '../models/follow.model';
import { NotificationRepository } from '../repositories/notification.respository';
import Notification from '../models/notification.model';
import { NotificationService } from '../services/notification.service';
import { NotificationController } from '../controllers/notification.controller';
import { SearchRoutes } from '../routes/search.routes';
import Like from '../models/like.model';
import { LikeRepository } from '../repositories/like.repository';
import UserAction from '../models/userAction.model';
import { FollowRepository } from '../repositories/follow.repository';
import { UserActionRepository } from '../repositories/userAction.repository';
import { WebSocketServer } from '../server/socketServer';


export function setupContainer(): void {

  // Register Models
  container.register('UserModel', { useValue: User });
  container.register('ImageModel', { useValue: Image });
  container.register('TagModel', { useValue: Tag });
  container.register('FollowModel', { useValue: Follow});
  container.register('NotificationModel', { useValue: Notification});
  container.register('LikeModel', { useValue: Like});
  container.register('UserActionModel', { useValue: UserAction});

  // Register Repositories as singletons
  container.register("WebSocketServer", {
    useClass: WebSocketServer
  });
  container.registerSingleton('UnitOfWork', UnitOfWork);
  container.registerSingleton('UserRepository', UserRepository);
  container.registerSingleton('ImageRepository', ImageRepository);
  container.registerSingleton('UserActionRepository', UserActionRepository);
  container.registerSingleton('TagRepository', TagRepository);
  container.registerSingleton('FollowRepository', FollowRepository);
  container.registerSingleton('NotificationRepository', NotificationRepository);
  container.registerSingleton('LikeRepository', LikeRepository);

  // Register Services as singletons
  container.registerSingleton('SearchService', SearchService);
  container.registerSingleton('CloudinaryService', CloudinaryService);
  container.registerSingleton('UserService', UserService);
  container.registerSingleton('ImageService', ImageService);
  container.registerSingleton('FollowService', FollowService);
  container.registerSingleton('NotificationService', NotificationService);

  // Register Controllers as singletons
  container.registerSingleton('SearchController', SearchController);
  container.registerSingleton('UserController', UserController);
  container.registerSingleton('ImageController', ImageController);
  container.registerSingleton('NotificationController', NotificationController);
  
  // Register Routes as singletons
  container.registerSingleton('UserRoutes', UserRoutes);
  container.registerSingleton('ImageRoutes', ImageRoutes);
  container.registerSingleton('SearchRoutes', SearchRoutes);
  // Register Server
  container.registerSingleton('WebSocketServer', WebSocketServer); 
  container.registerSingleton('Server', Server);

}
