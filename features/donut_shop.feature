Feature: Donut shop

  Scenario: A typical client-server database-backed web app
    Given there is a donut in the database
    When I visit the home page
    Then I should see the donut
    When I add a donut
    Then I should see two donuts
