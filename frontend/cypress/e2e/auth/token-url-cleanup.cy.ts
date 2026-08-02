describe("Email token URL cleanup", () => {
	beforeEach(() => {
		cy.intercept("GET", "/api/users/me", {
			statusCode: 401,
			body: { message: "Authentication required" },
		});
		cy.intercept("POST", "/api/users/refresh", {
			statusCode: 401,
			body: { message: "Authentication required" },
		});
	});

	it("captures a reset fragment before removing query and hash state", () => {
		cy.intercept("POST", "/api/users/reset-password", {
			statusCode: 200,
			body: { message: "Password reset successful" },
		}).as("resetPassword");

		cy.visit("/reset-password?campaign=private#token=reset-token");
		cy.location("search").should("eq", "");
		cy.location("hash").should("eq", "");

		cy.get("#newPassword").type("new-password-123");
		cy.get("#confirmPassword").type("new-password-123");
		cy.contains('button[type="submit"]', "Reset Password").click();

		cy.wait("@resetPassword").its("request.body").should("deep.equal", {
			token: "reset-token",
			newPassword: "new-password-123",
		});
	});

	it("captures verification fragment data before removing query and hash state", () => {
		const email = "verify@example.com";
		cy.intercept("POST", "/api/users/verify-email", {
			statusCode: 200,
			body: {
				publicId: "11111111-1111-4111-8111-111111111111",
				handle: "verified",
				username: "Verified",
				email,
				isEmailVerified: true,
				isAdmin: false,
			},
		}).as("verifyEmail");

		cy.visit(
			`/verify-email?campaign=private#token=12345&email=${encodeURIComponent(email)}`,
		);
		cy.location("search").should("eq", "");
		cy.location("hash").should("eq", "");
		cy.wait("@verifyEmail").its("request.body").should("deep.equal", {
			email,
			token: "12345",
		});
	});
});
