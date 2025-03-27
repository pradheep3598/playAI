import { expect, test, Page } from "@playwright/test";
import { playGemini } from "../src/ai/playGemini";
import * as dotenv from "dotenv";

dotenv.config();

// Get the Gemini API key from environment variables
const geminiApiKey = process.env.GEMINI_API_KEY;

// Create options with the Gemini API key
const options = {
  geminiApiKey,
  model: "gemini-2.0-flash-exp", // Using the model specified in the requirements
  debug: true // Enable debug mode to see detailed logs
};

test.describe("Playwright Integration With Gemini AI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("https://www.saucedemo.com/");
  });

  test.afterEach(async ({ page }) => {
    await page.close();
  });

  test("Gemini AI Test", async ({ page }) => {
    // Skip the test if no Gemini API key is provided
    if (!geminiApiKey) {
      test.skip();
      return;
    }

    await playGemini(
      `Type "standard_user" in the Username field`,
      { page, test },
      options
    );
    
    await playGemini(
      `Type "secret_sauce" in the Password field`,
      { page, test },
      options
    );
    
    await playGemini(
      "Click the Login button",
      {
        page,
        test,
      },
      options
    );

    const headerLabelText = await playGemini(
      "get the header logo label text",
      { page, test },
      options
    );

    expect(headerLabelText).toBe("Swag Labs");

    const firstLinkText = await playGemini(
      "get the first inventory item name from inventory list",
      { page, test },
      options
    );
    
    expect(firstLinkText).toBe("Sauce Labs Backpack");
  });

  test("Gemini AI Test With Nested Task", async ({ page }) => {
    // Skip the test if no Gemini API key is provided
    if (!geminiApiKey) {
      test.skip();
      return;
    }

    // Execute multiple commands in a single call
    await playGemini(
      [
        `Type "standard_user" in the Username field`,
        `Type "secret_sauce" in the Password field`,
        `Click the Login button`,
      ],
      { page, test },
      options
    );

    const headerLabelText = await playGemini(
      "get the header logo label text",
      { page, test },
      options
    );

    expect(headerLabelText).toBe("Swag Labs");

    const firstLinkText = await playGemini(
      "get the first inventory item name from inventory list",
      { page, test },
      options
    );
    
    expect(firstLinkText).toBe("Sauce Labs Backpack");
  });
}); 