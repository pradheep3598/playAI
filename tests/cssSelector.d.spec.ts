import { expect, test } from "@playwright/test";
import { completeTaskGemini } from "../src/ai/completeTaskGemini";
import { SelectorCache } from "../src/ai/selectorCache";
import { LoginHelper } from "../src/testfiles/loginHelper";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

// Get the Gemini API key from environment variables
const geminiApiKey = process.env.GEMINI_API_KEY;

// Create options with the Gemini API key
const options = {
  geminiApiKey,
  model: "gemini-2.0-flash-exp", // Using the specified model
  debug: true // Enable debug mode to see detailed logs
};

test.describe("CSS Selector Generation with Gemini", () => {
  let selectorCache: SelectorCache;
  let loginHelper: LoginHelper;

  test.beforeAll(() => {
    // Initialize cache with current test file path
    const testFilePath = path.resolve(__filename);
    selectorCache = new SelectorCache(testFilePath);
    loginHelper = new LoginHelper(selectorCache, options);
  });

  test("Get CSS selector for elements", async ({ page }) => {
    // Skip the test if no Gemini API key is provided
    if (!geminiApiKey) {
      test.skip();
      return;
    }

    // Navigate to the demo site
    await page.goto("https://www.saucedemo.com/");

    // Example 1: Get CSS selector for username field using the cache
    const usernameTask = "Find the CSS selector for the username input field";
    const usernameSelector = await selectorCache.getOrFindSelector(
      page,
      "Get CSS selector for elements",
      usernameTask,
      options
    );

    console.log("Username field selector:", usernameSelector);
    expect(usernameSelector).toBeTruthy();
    
    // Use the selector
    await page.locator(usernameSelector).fill("standard_user");
    const usernameElementCount = await page.locator(usernameSelector).count();
    console.log(`Found ${usernameElementCount} element(s) with selector: ${usernameSelector}`);
    expect(usernameElementCount).toBeGreaterThan(0);

    // Example 2: Get CSS selector for password field using the cache
    const passwordTask = "Find the CSS selector for the password input field";
    const passwordSelector = await selectorCache.getOrFindSelector(
      page,
      "Get CSS selector for elements",
      passwordTask,
      options
    );

    console.log("Password field selector:", passwordSelector);
    expect(passwordSelector).toBeTruthy();
    
    // Use the selector
    await page.locator(passwordSelector).fill("secret_sauce");
    const passwordElementCount = await page.locator(passwordSelector).count();
    console.log(`Found ${passwordElementCount} element(s) with selector: ${passwordSelector}`);
    expect(passwordElementCount).toBeGreaterThan(0);

    // Example 3: Get CSS selector for login button using the cache
    const loginButtonTask = "Find the CSS selector for the login button. It is likely an input element with type='submit' or a button element.";
    const loginButtonSelector = await selectorCache.getOrFindSelector(
      page,
      "Get CSS selector for elements",
      loginButtonTask,
      options
    );

    console.log("Login button selector:", loginButtonSelector);
    expect(loginButtonSelector).toBeTruthy();
    
    // Use the selector
    const buttonElementCount = await page.locator(loginButtonSelector).count();
    console.log(`Found ${buttonElementCount} element(s) with selector: ${loginButtonSelector}`);
    
    if (buttonElementCount > 0) {
      await page.locator(loginButtonSelector).click();
      await expect(page.locator('.inventory_list')).toBeVisible();
    } else {
      // Fallback if selector doesn't work
      console.log("Using alternative selector for login button");
      await page.locator('input[type="submit"], button[type="submit"], #login-button').click();
      await expect(page.locator('.inventory_list')).toBeVisible();
    }
  });

test("Get CSS selector for for letcodePage", async ({ page }) => {
    // Skip the test if no Gemini API key is provided
    if (!geminiApiKey) {
      test.skip();
      return;
    }

    // Navigate to the demo site
    await page.goto("https://letcode.in/forms");

    // Example 1: Get CSS selector for username field using the cache
    const firstName = `Type "Pradheep" in First name field`;
    const firstNameSelector = await selectorCache.getOrFindSelector(
      page,
      "Get CSS selector for elements",
      firstName,
      options
    );

    console.log("Username field selector:", firstNameSelector);
    await loginHelper.executeSingleStep(page, firstName);


    const lastName = `Type "Varatharajan" in last name field`;
    const lastNameSelector = await selectorCache.getOrFindSelector(
      page,
      "Get CSS selector for elements",
      lastName,
      options
    );

    console.log("Username field selector:", lastNameSelector);
    await loginHelper.executeSingleStep(page, lastName);


    const email = `Type "gmail.com" in Email field`;
    const emailSelector = await selectorCache.getOrFindSelector(
      page,
      "Get CSS selector for elements",
      email,
      options
    );

    console.log("Username field selector:", emailSelector);
    await loginHelper.executeSingleStep(page, email);

    const countryCode = `Select "India (+91)" in Country Code drop down`;
    const countryCodeSelector = await selectorCache.getOrFindSelector(
      page,
      "Get CSS selector for elements",
      countryCode,
      options
    );

    console.log("Username field selector:", countryCodeSelector);

    let countryCodeString = countryCodeSelector.split(">");
    
    await loginHelper.executeSingleStep(page, countryCode, countryCodeString[countryCodeString.length - 1]);


    const country = `Select "India" in Country drop down`;
    const countrySelector = await selectorCache.getOrFindSelector(
      page,
      "Get CSS selector for elements",
      country,
      options
    );

    console.log("Country field selector:", countrySelector);
    await loginHelper.executeSingleStep(page, country);

    const genderRadio = `Click "Male" on Gender radio button`;
    const genderRadioSelector = await selectorCache.getOrFindSelector(
      page,
      "Get CSS selector for elements",
      genderRadio,
      options
    );

    console.log("Gender radio field selector:", genderRadioSelector);
    await loginHelper.executeSingleStep(page, genderRadio);


    const checkBox = `Click Check box for "I agree to the terms and conditions"`;
    const checkBoxSelector = await selectorCache.getOrFindSelector(
      page,
      "Get CSS selector for elements",
      checkBox,
      options
    );

    console.log("Check box field selector:", checkBoxSelector);
    await loginHelper.executeSingleStep(page, checkBox);


    const calendarTask = `Type "08/04/2025" in Date Of Birth Calendar field`
    const calendarSelector = await selectorCache.getOrFindSelector(
      page,
      "Get CSS selector for elements",
      calendarTask,
      options
    );

    console.log("Calendar field selector:", calendarSelector);
    await loginHelper.executeSingleStep(page, calendarTask);

  });


test.only("Get CSS selector for iframe", async ({ page }) => {
    // Skip the test if no Gemini API key is provided
    if (!geminiApiKey) {
      test.skip();
      return;
    }

    // Navigate to the demo site
    await page.goto("https://letcode.in/frame");

    const firstNameTask = `Type "Pradheep" in First name field`
    const firstNameSelector = await selectorCache.getOrFindSelector(
      page,
      "Get CSS selector for elements",
      firstNameTask,
      options
    );

    console.log("First name field selector:", firstNameSelector);
    await loginHelper.executeSingleStep(page, firstNameTask, firstNameSelector);

    const lastNameTask = `Type "Varatharajan" in Last name field`
    const lastNameSelector = await selectorCache.getOrFindSelector(
      page,
      "Get CSS selector for elements",
      lastNameTask,
      options
    );

    console.log("Last name field selector:", lastNameSelector);
    await loginHelper.executeSingleStep(page, lastNameTask, lastNameSelector);


    const emailTask = `Type "pradheep.varatharajan@gmail.com" in Email field`
    const emailSelector = await selectorCache.getOrFindSelector(
      page,
      "Get CSS selector for elements",
      emailTask,
      options
    );

    console.log("Email field selector:", emailSelector);
    await loginHelper.executeSingleStep(page, emailTask, emailSelector);

  });

}); 