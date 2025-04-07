Feature: CSS Selector Generation with Gemini

Scenario: Fill form in letcode
  Open "https://letcode.in/forms"
  Type "Pradheep" in First name field
  Type "Varatharajan" in last name field
  Type "gmail.com" in Email field
  Select "India (+91)" in Country Code drop down
  Select "India" in Country drop down
  Click "Male" on Gender radio button
  Click Check box for "I agree to the terms and conditions"

Scenario: Login with standard user
    Open "https://www.saucedemo.com/" website
    type "standard_user" in the username field
    type "secret_sauce" in the password field
    click login button

Scenario: Fill iframe form in letcode
  Open "https://letcode.in/frame"
  Type "Pradheep" in First name field
  Type "Varatharajan" in Last name field
  Type "pradheep.varatharajan@gmail.com" in Email field 