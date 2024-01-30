@QA0001
Feature: Get all firmwares
      | Case    | Description       | Code |
      | Default | Get all firmwares | 200  |

  Scenario Outline: Default case QA0001
    When I send a "GET" request to "get all people" endpoint
      | parameter | value |
    Then The response code is 200
    Then I save the response body into the file "qa0001_get-All-people.json"
    And The json file "qa0001_get-All-people.json" is equal to the expected json file "qa0001_get-All-people.json"