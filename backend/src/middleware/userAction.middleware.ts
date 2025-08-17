import { Request, Response, NextFunction } from "express";
import UserAction from "../models/userAction.model";

export function logUserAction(req: Request, res: Response, next: NextFunction): void {
	const userId = req?.decodedUser?._id;
	const actionType = req.route.path;
	const targetId = req.params.id;

	if (!userId) {
		next();
		return;
	}

	const userAction = new UserAction({
		userId,
		actionType,
		targetId,
	});

	userAction
		.save()
		.then(() => next())
		.catch((err) => {
			console.error("Error logging user action:", err);
			next();
		});
}
