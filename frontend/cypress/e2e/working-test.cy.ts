describe("Working E2E Tests", () => {
	const timestamp = Date.now();
	const testUser = {
		username: `user${timestamp}`,
		email: `user${timestamp}@test.com`,
		password: "password123",
	};

	it("should successfully register and login a user", () => {
		// Register
		cy.visit("/register");
		cy.get('input[name="username"]').type(testUser.username);
		cy.get('input[name="email"]').type(testUser.email);
		cy.get('input[name="password"]').type(testUser.password);
		cy.get('input[name="confirmPassword"]').type(testUser.password);
		cy.get('button[type="submit"]').click();

		// Login
		cy.visit("/login");
		cy.get('input[name="email"]').type(testUser.email);
		cy.get('input[name="password"]').type(testUser.password);
		cy.get('button[type="submit"]').click();

		// Should be on home page
		cy.url().should("not.include", "/login");
		cy.contains("Home").should("exist");
	});

	it("should find and click the Post button successfully", () => {
		// Login first
		cy.visit("/login");
		cy.get('input[name="email"]').type(testUser.email);
		cy.get('input[name="password"]').type(testUser.password);
		cy.get('button[type="submit"]').click();
		cy.url().should("not.include", "/login");

		// Wait a moment for page to load
		cy.wait(2000);

		// Click the Post button using the test ID
		cy.get('[data-testid="post-button"]').should("be.visible").click();

		// Verify upload modal opens
		cy.get('[aria-labelledby="upload-modal-title"]').should("be.visible");
	});

	it("should allow user to upload a test image", () => {
		// Login first
		cy.visit("/login");
		cy.get('input[name="email"]').type(testUser.email);
		cy.get('input[name="password"]').type(testUser.password);
		cy.get('button[type="submit"]').click();
		cy.url().should("not.include", "/login");

		// Wait for page to load
		cy.wait(2000);

		// Open upload modal
		cy.get('[data-testid="post-button"]').click();
		cy.get('[aria-labelledby="upload-modal-title"]').should("be.visible");

		// Upload file
		cy.get('input[type="file"]').attachFile("test-image.png");

		// Wait for preview
		cy.get('img[src*="blob:"], img[src*="data:"]', { timeout: 5000 }).should("be.visible");

		// Add some tags
		cy.get('input[id="tags"]').type("test{enter}");
		cy.get('input[id="tags"]').type("cypress{enter}");

		// Upload
		cy.get("button").contains("Upload Image").click();

		// Modal should close
		cy.get('[aria-labelledby="upload-modal-title"]', { timeout: 10000 }).should("not.exist");

		// Image should appear in feed
		cy.get(".MuiCard-root", { timeout: 10000 }).should("exist");
	});
});
