import { Then } from "@badeball/cypress-cucumber-preprocessor";
const _ = require("lodash");

Then('I save the response body into the file {string}', function (fileName) {
    cy.get('@request').then((response) => {
        cy.writeFile('cypress/fixtures/response_body/' + fileName, response.body)
    })
});

Then("The json file {string} is equal to the expected json file {string}", function (responseJsonFile, expectedJsonFile) {
    cy.fixture('response_body/' + responseJsonFile).then((responseJson) => {
        cy.readFile('cypress/fixtures/expected_body/' + expectedJsonFile).then((expectedJson) => {
            cy.log("responseJson")
            cy.log(JSON.stringify(responseJson))
            cy.log("expectedJson")
            cy.log(JSON.stringify(expectedJson))
        })

        cy.readFile('cypress/fixtures/expected_body/' + expectedJsonFile).then((expectedJson) => {
            expect(_.isMatch(responseJson, expectedJson)).to.be.true;
        })
    })
});