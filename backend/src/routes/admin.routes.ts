import express, { RequestHandler } from 'express';
import { AdminUserController } from '../controllers/admin.controller';
import { AuthFactory } from '../middleware/authentication.middleware';
import { inject, injectable } from 'tsyringe';

// A middleware to ensure the user is admin.
const adminOnly: RequestHandler = (req, res, next) => {
  console.log(req.decodedUser)
  if (req?.decodedUser && req.decodedUser.isAdmin) {
    next();
    return;
  }
  res.status(403).json({ error: 'Admin privileges required.' });
  return;
};


@injectable()
export class AdminUserRoutes {
  private router: express.Router;
  private auth = AuthFactory.bearerToken().handle();

  constructor(
    @inject('AdminUserController') private readonly adminUserController: AdminUserController
  ) {
    this.router = express.Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    const protectedRouter = express.Router();
    this.router.use(protectedRouter); //mount the protectedRouter
    protectedRouter.use(this.auth);
    this.router.use(adminOnly);

    // ===Admin endpoints===

    //Get all users
    this.router.get('/', this.adminUserController.getAllUsersAdmin);

    //Get user by id 
    this.router.get('/user/:id', this.adminUserController.getUser);

    //Delete a user by id
    this.router.delete('/user/:id', this.adminUserController.deleteUser);

    //Delete an image by id
    this.router.delete('/image/:id', this.adminUserController.deleteImage);


  }

  public getRouter(): express.Router {
    return this.router;
  }
}
