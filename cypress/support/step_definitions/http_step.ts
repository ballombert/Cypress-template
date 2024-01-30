import { Then } from "@badeball/cypress-cucumber-preprocessor";

Then("The response code is {int}", function (statusCode) {
   cy.get('@request').then((response)=>{
        expect(response.status).to.eq(statusCode);
   })
});

Then('The response body is {string}', function (responseBody) {
   cy.get('@request').then((response) => {
       var body = JSON.stringify(response.body)
       expect(body).to.eq(JSON.stringify(responseBody));
   })
});