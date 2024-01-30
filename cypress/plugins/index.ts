/// <reference types="cypress" />
// ***********************************************************
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

/**
 * @type {Cypress.PluginConfig}
 */
 
const createBundler = require("@bahmutov/cypress-esbuild-preprocessor");
const preprocessor = require("@badeball/cypress-cucumber-preprocessor");
const createEsbuildPlugin = require("@badeball/cypress-cucumber-preprocessor/esbuild");

const _ = require("lodash");
////////////////////CONFIGURATION BY ENV ///////////////////////////
const fs = require("fs-extra");
const path = require("path");

const importDynamic = new Function("modulePath", "return import(modulePath)");

const fetch = async (...args: any[]) => {
  const module = await importDynamic("node-fetch");
  return module.default(...args);
};

async function getConfigByEnv(environment) {
  const pathToConfigFile = path.resolve(
    ".",
    "cypress",
    "environment.config",
    `${environment}.json`
  );
  const config = await fs.readJson(pathToConfigFile);
  return config;
}
////////////////////CONFIGURATION BY ENV ///////////////////////////

module.exports = async function (on, configDefault) {
  var env = configDefault.env.CY_ENVIRONMENT;

  const configEnv = await getConfigByEnv(env);
  const config = _.merge(configDefault, configEnv);
 
  // Cucumber
  const options = {
    typescript: require.resolve("typescript"),
  };

  await preprocessor.addCucumberPreprocessorPlugin(on, config);
  on(
    "file:preprocessor",
    createBundler({
      plugins: [createEsbuildPlugin.default(config)],
    })
  );
  
  return config;
};
