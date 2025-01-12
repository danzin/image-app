import express from 'express';
import bodyParser from 'body-parser';
import { UserRoutes } from '../routes/user.routes';
import { ImageRoutes } from '../routes/image.routes';
// import { PhotoRoutes } from '../routes/photo.routes';
import { createError, ErrorHandler } from '../utils/errors';
import morgan from 'morgan'; 
import logger from '../utils/winston';
import cors from 'cors';
import { corsOptions } from '../config/corsConfig';

export class Server {
  private app: express.Application;
  private port: number;

  constructor(port: number){
    this.app = express();
    this.port = port;
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeRoutes(){
    const userRoutes = new UserRoutes();
    const imageRoutes = new ImageRoutes();

    this.app.use(cors(corsOptions));
    
    this.app.use(bodyParser.json({strict: true}))
    this.app.use(morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim())
      }
    }));
    this.app.use('/api/images', imageRoutes.router);
    this.app.use('/api/users', userRoutes.router);


  }

  private initializeErrorHandling() {
    //Handle malformed JSON errors
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (err instanceof SyntaxError && 'body' in err) {
        next(createError('ValidationError', 'Malformed JSON in request'));
      }
      next(err); 
    });

    //Handle path errors
    this.app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    next(createError('PathError', `Path ${req.url} not found`));
    });

    //Other errors
    this.app.use(ErrorHandler.handleError as express.ErrorRequestHandler);
  }

  public start(){
    this.app.listen(this.port, () =>{
      console.log(`Server running on ${this.port}`);
    });
  }
}