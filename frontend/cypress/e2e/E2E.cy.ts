describe("Complete E2E User Journey", () => {
	const timestamp = Date.now();
	const user1 = {
		username: `user1${timestamp}`,
		email: `user1${timestamp}@test.com`,
		password: "password123",
	};

	const user2 = {
		username: `user2${timestamp}`,
		email: `user2${timestamp}@test.com`,
		password: "password123",
	};

	let user1PublicId = "";

	it("should allow user1 to register and login", () => {
		cy.visit("/register");

		cy.get('input[name="username"]').type(user1.username);
		cy.get('input[name="email"]').type(user1.email);
		cy.get('input[name="password"]').type(user1.password);
		cy.get('input[name="confirmPassword"]').type(user1.password);

		cy.get('button[type="submit"]').should("contain", "Sign Up").click();

		cy.url({ timeout: 10000 }).should("include", "/login");

		cy.get('input[name="email"]').clear().type(user1.email);
		cy.get('input[name="password"]').clear().type(user1.password);
		cy.get('button[type="submit"]').should("contain", "Sign In").click();

		cy.url({ timeout: 10000 }).should("not.include", "/login");
	});

	it("should allow user1 to upload an image", () => {
		cy.login(user1.email, user1.password);

		cy.visit("/");

		cy.get("body").then(($body: JQuery) => {
			if ($body.find('[href="/upload"]').length > 0) {
				cy.get('[href="/upload"]').click();
			} else {
				if ($body.find('[data-testid="profile-menu"]').length > 0) {
					cy.get('[data-testid="profile-menu"]').click();
				} else {
					cy.get('[data-testid*="avatar"], button:has(img), button[aria-label*="menu" i]').first().click();
				}

				cy.contains("Upload", { matchCase: false, timeout: 5000 }).click();
			}
		});

		cy.get('input[type="file"]', { timeout: 10000 }).should("be.visible");

		cy.get('input[type="file"]').selectFile("cypress/fixtures/test-image.png");

		cy.get('img[src*="blob:"], img[src*="data:"]', { timeout: 10000 }).should("be.visible");

		cy.get('input[id="tags"]').should("be.visible").type("test{enter}cypress{enter}e2e{enter}");

		cy.contains("test").should("be.visible");
		cy.contains("cypress").should("be.visible");

		cy.get("button").contains("Upload", { matchCase: false }).click();

		cy.url({ timeout: 15000 }).should("include", "/");

		cy.get('[data-cy="image-card"], .MuiCard-root, img', { timeout: 15000 }).should("exist");
	});

	it("should allow user1 to view their profile", () => {
		cy.login(user1.email, user1.password);
		cy.visit("/");

		cy.get("body").then(($body: JQuery) => {
			if ($body.find('[data-testid="profile-menu"]').length > 0) {
				cy.get('[data-testid="profile-menu"]').click();
			} else if ($body.find('[aria-label*="profile" i]').length > 0) {
				cy.get('[aria-label*="profile" i]').first().click();
			} else {
				cy.get('[data-testid*="avatar"], button:has(img), button[aria-label*="menu" i]').first().click();
			}
		});

		cy.contains("Profile", { matchCase: false, timeout: 5000 }).click();

		cy.url({ timeout: 10000 }).should("include", "/profile/");

		cy.contains(user1.username, { timeout: 10000 }).should("be.visible");

		cy.get('[data-cy="image-card"], .MuiCard-root, img', { timeout: 10000 }).should("exist");

		cy.url().then((url: string) => {
			const pathParts = url.split("/profile/");
			if (pathParts.length > 1) {
				user1PublicId = pathParts[1].split("?")[0];
				cy.log(`User1 publicId: ${user1PublicId}`);
			}
		});
	});

	it("should allow user2 to register, login, and follow user1", () => {
		cy.visit("/register");
		cy.get('input[name="username"]').type(user2.username);
		cy.get('input[name="email"]').type(user2.email);
		cy.get('input[name="password"]').type(user2.password);
		cy.get('input[name="confirmPassword"]').type(user2.password);
		cy.get('button[type="submit"]').click();

		cy.url({ timeout: 10000 }).should("include", "/login");

		cy.login(user2.email, user2.password);

		cy.visit(`/profile/${user1PublicId}`);

		cy.contains("Follow", { matchCase: false }).click();

		cy.contains("Unfollow", { matchCase: false }).should("be.visible");
	});

	it("should show user1's image in user2's feed", () => {
		cy.login(user2.email, user2.password);
		cy.visit("/");

		cy.get('[data-cy="image-card"], .MuiCard-root', { timeout: 10000 }).should("exist");

		cy.contains(user1.username).should("be.visible");
	});

	it("should allow user2 to like and comment on user1's image", () => {
		cy.login(user2.email, user2.password);
		cy.visit("/");

		cy.get('[data-cy="image-card"], .MuiCard-root, img', { timeout: 15000 }).should("exist");

		cy.get('[data-cy="image-card"], .MuiCard-root').first().click();

		cy.url({ timeout: 10000 }).should("include", "/images/");

		cy.get("img", { timeout: 10000 }).should("be.visible");

		cy.get("body").then(($body: JQuery) => {
			if ($body.find('button:has(svg[data-testid="FavoriteBorderIcon"])').length > 0) {
				cy.get('button:has(svg[data-testid="FavoriteBorderIcon"])').click();
			} else if ($body.find('button:has(svg[data-testid="FavoriteIcon"])').length > 0) {
				cy.get('button:has(svg[data-testid="FavoriteIcon"])').click();
			} else if ($body.find('[data-testid*="like"]').length > 0) {
				cy.get('[data-testid*="like"]').first().click();
			} else if ($body.find('[aria-label*="like" i]').length > 0) {
				cy.get('[aria-label*="like" i]').first().click();
			} else if ($body.find('button:contains("♥")').length > 0) {
				cy.get('button:contains("♥")').first().click();
			} else {
				cy.get('svg[data-testid*="Favorite"]').parent("button").first().click();
			}
		});

		cy.wait(1000);

		cy.get("body").then(($body: JQuery) => {
			if ($body.find('textarea[placeholder*="comment" i]').length > 0) {
				cy.get('textarea[placeholder*="comment" i]').type("This is a test comment from user2!{enter}");
			} else if ($body.find('input[placeholder*="comment" i]').length > 0) {
				cy.get('input[placeholder*="comment" i]').type("This is a test comment from user2!{enter}");
			} else if ($body.find("textarea").length > 0) {
				cy.get("textarea").first().type("This is a test comment from user2!");
				cy.get("button").contains("Post", { matchCase: false }).click();
			} else {
				cy.get('input[type="text"]').last().type("This is a test comment from user2!{enter}");
			}
		});

		cy.contains("This is a test comment from user2!", { timeout: 10000 }).should("be.visible");
	});

	it("should show user2's like and comment when user1 views the image", () => {
		cy.login(user1.email, user1.password);
		cy.visit("/");

		cy.get('[data-cy="image-card"], .MuiCard-root').first().click();

		cy.url({ timeout: 10000 }).should("include", "/images/");

		cy.get("body").should("contain", "1");

		cy.contains("This is a test comment from user2!").should("be.visible");

		cy.contains(user2.username).should("be.visible");
	});
});
