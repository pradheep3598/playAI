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

  

// Updated test using LoginHelper
  test("Execute login steps from file", async ({ page }) => {
    // Skip the test if no Gemini API key is provided
    if (!geminiApiKey) {
      test.skip();
      return;
    }

    await loginHelper.navigateToLoginPage(page);
    await loginHelper.executeLoginSteps(page, 'loginTest.txt');
    
    // Additional verification if needed
    await expect(page.locator('.inventory_list')).toBeVisible();
  });
}); 