describe("Complete E2E User Journey", () => {
	const user1 = {
		username: `user1_${Date.now()}`,
		email: `user1_${Date.now()}@test.com`,
		password: "password123",
	};

	const user2 = {
		username: `user2_${Date.now()}`,
		email: `user2_${Date.now()}@test.com`,
		password: "password123",
	};

	let user1PublicId = "";

	it("should allow user1 to register and login", () => {
		cy.visit("/register");
		cy.get('input[name="username"]').type(user1.username);
		cy.get('input[name="email"]').type(user1.email);
		cy.get('input[name="password"]').type(user1.password);
		cy.get('button[type="submit"]').click();
		cy.url().should("include", "/login");

		cy.get('input[name="email"]').type(user1.email);
		cy.get('input[name="password"]').type(user1.password);
		cy.get('button[type="submit"]').click();
		cy.url().should("not.include", "/login");
		cy.contains(`Welcome, ${user1.username}`).should("be.visible");

		// Get user1's publicId from the profile link
		cy.get('a[href^="/profile/"]')
			.invoke("attr", "href")
			.then((href) => {
				if (href) {
					user1PublicId = href.split("/").pop() as string;
					cy.log(`User1 publicId: ${user1PublicId}`);
				}
			});
	});

	it("should allow user1 to upload an image", () => {
		cy.login(user1.email, user1.password);
		cy.visit("/upload");
		cy.get('input[type="file"]').selectFile("cypress/fixtures/test-image.jpg", { force: true });
		cy.get('textarea[name="description"]').type("This is a test image upload.");
		cy.get('input[name="tags"]').type("test, cypress, e2e");
		cy.get('button[type="submit"]').click();
		cy.url().should("include", "/");
		cy.contains("Image uploaded successfully").should("be.visible");
		cy.get('img[alt="This is a test image upload."]').should("be.visible");
	});

	it("should allow user2 to register, login, and follow user1", () => {
		cy.visit("/register");
		cy.get('input[name="username"]').type(user2.username);
		cy.get('input[name="email"]').type(user2.email);
		cy.get('input[name="password"]').type(user2.password);
		cy.get('button[type="submit"]').click();
		cy.url().should("include", "/login");

		cy.login(user2.email, user2.password);
		cy.visit(`/profile/${user1PublicId}`);
		cy.contains("Follow").click();
		cy.contains("Unfollow").should("be.visible");
	});

	it("should show user1's image in user2's feed", () => {
		cy.login(user2.email, user2.password);
		cy.visit("/");
		cy.get('img[alt="This is a test image upload."]').should("be.visible");
	});

	it("should allow user2 to like and comment on user1's image", () => {
		cy.login(user2.email, user2.password);
		cy.visit("/");
		cy.get('[data-testid="like-button"]').first().click();
		cy.get('[data-testid="like-count"]').should("contain", "1");

		cy.get('[data-testid="comment-input"]').first().type("This is a test comment.{enter}");
		cy.contains("This is a test comment.").should("be.visible");
	});

	it("should show user2's like and comment in real-time for user1", () => {
		cy.login(user1.email, user1.password);
		cy.visit("/");
		cy.get('[data-testid="like-count"]').should("contain", "1");
		cy.contains("This is a test comment.").should("be.visible");
	});
});
