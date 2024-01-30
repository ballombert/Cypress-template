import { defineConfig } from "cypress";

export default defineConfig({
  env: {
    apiBaseUrl: "https://swapi.dev/api/",
    defaultWait: 10000,
  },
  e2e: {
    reporter: "mocha-junit-reporter",
    reporterOptions: {
      mochaFile: "results/junit/test-results.[hash].xml",
      testsuitesTitle: false,
    },
    specPattern: "**/*.feature",
    supportFile: "./cypress/support/e2e.ts",
    fixturesFolder: "./cypress/fixtures",

    // prefix async
    async setupNodeEvents(on, config) {
      // return any mods to Cypress
      return require('./cypress/plugins/index.ts')(on, config);
    }
  },
});
