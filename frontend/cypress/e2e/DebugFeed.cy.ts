/// <reference types="cypress" />

describe("Debug Feed Issue", () => {
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

	function loginUser(email: string, password: string) {
		cy.visit("/login");
		cy.get('input[name="email"]').type(email);
		cy.get('input[name="password"]').type(password);
		cy.get('button[type="submit"]').click();
		cy.url().should("eq", Cypress.config().baseUrl + "/");
	}

	function registerUser(email: string, password: string, username: string) {
		cy.visit("/register");
		cy.get('input[name="email"]').type(email);
		cy.get('input[name="username"]').type(username);
		cy.get('input[name="password"]').type(password);
		cy.get('input[name="confirmPassword"]').type(password);
		cy.get('button[type="submit"]').click();
		cy.url().should("eq", Cypress.config().baseUrl + "/");
	}

	it("should debug feed relationship", () => {
		// Step 1: Register User1
		registerUser(user1.email, user1.password, user1.username);

		// Step 2: Upload image as User1
		cy.get('[data-testid="upload-button"]', { timeout: 10000 }).should("be.visible").click();

		cy.get('input[type="file"]').attachFile("test-image.jpg");
		cy.get('input[name="tags"]').type("test,debug");

		cy.get('button[type="submit"]', { timeout: 10000 }).should("be.visible").and("not.be.disabled").click();

		// Wait for upload success
		cy.contains("Image uploaded successfully", { timeout: 15000 }).should("be.visible");
		cy.wait(2000);

		// Step 3: Logout User1
		cy.get('[data-testid="profile-menu-button"]').click();
		cy.contains("Logout").click();
		cy.url().should("include", "/");

		// Step 4: Register User2
		registerUser(user2.email, user2.password, user2.username);

		// Step 5: Search for User1 to follow
		cy.get('[data-testid="search-button"]', { timeout: 10000 }).should("be.visible").click();
		cy.get('input[placeholder*="Search"]').type(user1.username);
		cy.get('button[type="submit"]').click();

		// Follow User1
		cy.contains(user1.username, { timeout: 10000 }).should("be.visible");
		cy.contains(user1.username).parent().find("button").contains("Follow").click();
		cy.contains("Following", { timeout: 5000 }).should("be.visible");

		// Step 6: Go to Home and check feed
		cy.visit("/");
		cy.wait(3000); // Give time for feed to load

		// Debug: Log what's actually in the feed
		cy.get("body").then(() => {
			cy.window().then((win) => {
				console.log("Current URL:", win.location.href);
			});
		});

		// Check if there are any cards at all
		cy.get(".MuiCard-root", { timeout: 15000 }).should("exist");

		// Debug: Get all card content
		cy.get(".MuiCard-root").then(($cards) => {
			console.log("Found cards:", $cards.length);
			$cards.each((index, card) => {
				console.log(`Card ${index}:`, card.textContent);
			});
		});

		// Try to find user1's content in a more flexible way
		cy.get(".MuiCard-root").should("contain.text", user1.username);
	});
});
