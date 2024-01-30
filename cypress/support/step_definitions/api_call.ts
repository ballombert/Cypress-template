import { DataTable, When } from "@badeball/cypress-cucumber-preprocessor";

When('I send a {string} request to {string} endpoint', (method:string, route:string, dataTable:DataTable) => {
    cy.fixture("request.json").then((requests) => {
        var url: string = requests[route];
        dataTable.hashes().forEach(param => {
            url = url.replace(`[${param.parameter}]`, `${param.value}`);
        });
        cy.log(url);
        cy.request({
            method: method,
            url: Cypress.env("apiBaseUrl") + url,
            failOnStatusCode: false,
          }).as('request')
    });
})