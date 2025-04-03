Feature: Login to Sauce Demo
  As a user
  I want to login to Sauce Demo
  So that I can access the inventory page

  Scenario: Login with standard user
    Open "https://www.saucedemo.com/" website
    type "standard_user" in the username field
    type "secret_sauce" in the password field
    click login button

  Scenario: Login with problem user
    Open "https://www.saucedemo.com/" website
    type "problem_user" in the username field
    type "secret_sauce" in the password field
    click login button