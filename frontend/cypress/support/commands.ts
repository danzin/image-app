/// <reference types="cypress" />

// Import cypress-file-upload
import "cypress-file-upload";

// Add custom commands
Cypress.Commands.add("login", (email: string, password: string) => {
	cy.visit("/login");
	cy.get('input[name="email"]').clear().type(email);
	cy.get('input[name="password"]').clear().type(password);
	cy.get('button[type="submit"]').click();
	cy.url().should("not.include", "/login");
});

// Export to make it a module
export {};
