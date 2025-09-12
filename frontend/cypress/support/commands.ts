/// <reference types="cypress" />
/// <reference types="cypress-file-upload" />

declare namespace Cypress {
	interface Chainable {
		login(email: string, password: string): Chainable<void>;
	}
}

Cypress.Commands.add("login", (email: string, password: string) => {
	cy.session([email, password], () => {
		cy.visit("/login");
		cy.get('input[name="email"]').type(email);
		cy.get('input[name="password"]').type(password);
		cy.get('button[type="submit"]').click();
		cy.url().should("not.include", "/login");
	});
});