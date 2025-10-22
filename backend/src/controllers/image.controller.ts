import { injectable } from "tsyringe";
import { PostController } from "./post.controller";

@injectable()
export class ImageController extends PostController {}
