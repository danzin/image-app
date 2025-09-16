/// <reference types="cypress" />

describe("Feed Invalidation Debug", () => {
	let user1: { email: string; password: string; username: string };
	let user2: { email: string; password: string; username: string };

	beforeEach(() => {
		// Generate unique users for each test
		const timestamp = Date.now();
		user1 = {
			email: `user1_${timestamp}@test.com`,
			password: "password123",
			username: `user1${timestamp}`,
		};
		user2 = {
			email: `user2_${timestamp}@test.com`,
			password: "password123",
			username: `user2${timestamp}`,
		};

		cy.visit("/");
	});

	it("should test feed invalidation when followed user uploads image", () => {
		// Step 1: Register User1
		cy.visit("/register");
		cy.get('input[name="email"]').type(user1.email);
		cy.get('input[name="username"]').type(user1.username);
		cy.get('input[name="password"]').type(user1.password);
		cy.get('input[name="confirmPassword"]').type(user1.password);
		cy.get('button[type="submit"]').click();
		cy.url().should("include", "/");

		// Logout User1
		cy.visit("/login"); // Go to login page (effectively logs out)

		// Step 2: Register User2
		cy.visit("/register");
		cy.get('input[name="email"]').type(user2.email);
		cy.get('input[name="username"]').type(user2.username);
		cy.get('input[name="password"]').type(user2.password);
		cy.get('input[name="confirmPassword"]').type(user2.password);
		cy.get('button[type="submit"]').click();
		cy.url().should("include", "/");

		// Step 3: User2 follows User1
		cy.get('[data-testid="search-button"]', { timeout: 10000 }).should("be.visible").click();
		cy.get('input[placeholder*="Search"]').type(user1.username);
		cy.get('button[type="submit"]').click();

		cy.contains(user1.username, { timeout: 10000 }).should("be.visible");
		cy.contains(user1.username).parent().find("button").contains("Follow").click();
		cy.contains("Following", { timeout: 5000 }).should("be.visible");

		// Step 4: Go to home and verify empty feed
		cy.visit("/");
		cy.wait(3000);

		// Should not see any images yet since User1 hasn't uploaded anything
		cy.get("body").then(($body) => {
			if ($body.find(".MuiCard-root").length > 0) {
				cy.log("Feed has content already - this is unexpected");
			}
		});

		// Step 5: Login as User1 and upload an image
		cy.visit("/login");
		cy.get('input[name="email"]').type(user1.email);
		cy.get('input[name="password"]').type(user1.password);
		cy.get('button[type="submit"]').click();
		cy.url().should("include", "/");

		cy.get('[data-testid="upload-button"]', { timeout: 10000 }).should("be.visible").click();
		cy.get('input[type="file"]').attachFile("test-image.jpg");
		cy.get('input[name="tags"]').type("feedtest,debug");
		cy.get('button[type="submit"]', { timeout: 10000 }).should("be.visible").and("not.be.disabled").click();

		// Wait for upload success
		cy.contains("Image uploaded successfully", { timeout: 15000 }).should("be.visible");
		cy.wait(3000); // Give time for feed invalidation to process

		// Step 6: Login as User2 and check feed
		cy.visit("/login");
		cy.get('input[name="email"]').type(user2.email);
		cy.get('input[name="password"]').type(user2.password);
		cy.get('button[type="submit"]').click();
		cy.url().should("include", "/");

		// Wait for feed to load
		cy.wait(5000);

		// User2's feed should now show User1's image
		cy.get(".MuiCard-root", { timeout: 15000 }).should("exist");
		cy.get(".MuiCard-root").should("contain.text", user1.username);
	});
});
