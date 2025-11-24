describe("Simple E2E Test", () => {
	const timestamp = Date.now();
	const testUser = {
		username: `testuser${timestamp}`,
		email: `testuser${timestamp}@test.com`,
		password: "password123",
	};

	it("should register a new user", () => {
		cy.visit("/register");

		// Fill registration form
		cy.get('input[name="username"]').type(testUser.username);
		cy.get('input[name="email"]').type(testUser.email);
		cy.get('input[name="password"]').type(testUser.password);
		cy.get('input[name="confirmPassword"]').type(testUser.password);

		// Submit registration
		cy.get('button[type="submit"]').contains("Sign Up").click();

		// Should redirect to login
		cy.url().should("include", "/login");
	});

	it("should login the user", () => {
		cy.visit("/login");

		// Login with the user
		cy.get('input[name="email"]').type(testUser.email);
		cy.get('input[name="password"]').type(testUser.password);
		cy.get('button[type="submit"]').contains("Sign In").click();

		// Should be logged in and redirected home
		cy.url().should("not.include", "/login");
		cy.url().should("eq", "http://localhost:5173/");

		// Should see the left sidebar or mobile menu
		cy.get("body").should("be.visible");

		// Check if left sidebar exists
		cy.get("body").then(($body) => {
			if ($body.find('[data-testid="left-sidebar"]').length > 0) {
				cy.get('[data-testid="left-sidebar"]').should("be.visible");
				cy.log("Desktop left sidebar found");
			} else {
				// Check for mobile hamburger menu
				cy.get('button[aria-label="open drawer"]').should("be.visible");
				cy.log("Mobile hamburger menu found");
			}
		});
	});

	it("should find and click the Post button", () => {
		// Login first
		cy.visit("/login");
		cy.get('input[name="email"]').type(testUser.email);
		cy.get('input[name="password"]').type(testUser.password);
		cy.get('button[type="submit"]').contains("Sign In").click();
		cy.url().should("not.include", "/login");

		// Wait for page to load
		cy.wait(2000);

		// Try to find the Post button
		cy.get("body").then(($body) => {
			if ($body.find('[data-testid="left-sidebar"]').length > 0) {
				// Desktop: try to find Post button in sidebar
				cy.log("Trying desktop left sidebar");
				cy.get('[data-testid="left-sidebar"]').within(() => {
					cy.contains("Post").should("be.visible").click();
				});
			} else if ($body.find('button[aria-label="open drawer"]').length > 0) {
				// Mobile: open drawer and find Post button
				cy.log("Trying mobile hamburger menu");
				cy.get('button[aria-label="open drawer"]').click();
				cy.get(".MuiDrawer-paper")
					.should("be.visible")
					.within(() => {
						cy.contains("Post").should("be.visible").click();
					});
			} else {
				// Fallback: just look for any Post button
				cy.log("Trying fallback Post button search");
				cy.contains("Post").should("be.visible").click();
			}
		});

		// Should open upload modal
		cy.get('[aria-labelledby="upload-modal-title"]', { timeout: 10000 }).should("be.visible");
	});
});
