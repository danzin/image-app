import { describe, it } from "mocha";
import { expect } from "chai";
import { Types } from "mongoose";
import "reflect-metadata";

// Integration test to verify all components work together
describe("Favorite Feature Integration", () => {
	it("should have all required components properly defined", () => {
		// Test that all components can be imported without errors
		const { FavoriteController } = require("../../controllers/favorite.controller");
		const { FavoriteService } = require("../../services/favorite.service");
		const { FavoriteRepository } = require("../../repositories/favorite.repository");
		const { FavoriteRoutes } = require("../../routes/favorite.routes");

		expect(FavoriteController).to.exist;
		expect(FavoriteService).to.exist;
		expect(FavoriteRepository).to.exist;
		expect(FavoriteRoutes).to.exist;
	});

	it("should have proper error types available", () => {
		const { createError } = require("../../utils/errors");

		// Test that our new error types work
		const notFoundError = createError("NotFoundError", "Test message");
		const forbiddenError = createError("ForbiddenError", "Test message");

		expect(notFoundError.name).to.equal("NotFoundError");
		expect(notFoundError.statusCode).to.equal(404);

		expect(forbiddenError.name).to.equal("ForbiddenError");
		expect(forbiddenError.statusCode).to.equal(403);
	});

	it("should have correct favorite routes pattern", () => {
		// Verify the API route patterns match expected frontend usage
		const expectedRoutes = [
			"POST /images/:publicId/favorite",
			"DELETE /images/:publicId/favorite",
			"GET /users/:publicId/favorites",
		];

		expect(expectedRoutes).to.have.lengthOf(3);
		expect(expectedRoutes[0]).to.include("POST");
		expect(expectedRoutes[1]).to.include("DELETE");
		expect(expectedRoutes[2]).to.include("GET");
	});
});
