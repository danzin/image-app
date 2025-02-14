// Must use require otherwise Cypress halts on initializing e2e testing. Modern imports and .mts doesn't solve it. 
const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173/',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false, 
    screenshotOnRunFailure: true,
    supportFile: 'cypress/support/e2e.ts', 
  }
});