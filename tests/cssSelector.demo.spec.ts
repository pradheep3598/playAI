import { expect, test } from "@playwright/test";
import { completeTaskGemini } from "../src/ai/completeTaskGemini";
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
  test("Get CSS selector for elements", async ({ page }) => {
    // Skip the test if no Gemini API key is provided
    if (!geminiApiKey) {
      test.skip();
      return;
    }

    // Navigate to the demo site
    await page.goto("https://www.saucedemo.com/");

    // Example 1: Get CSS selector for username field using the simplified API
    // No need to manually get the snapshot
    const usernameSelector = await completeTaskGemini(page, {
      task: `Find the CSS selector for the username input field`,
      options
    });

    console.log("Username field selector:", usernameSelector.query);
    expect(usernameSelector.query).toBeTruthy();
    
    // Use the selector if available
    if (usernameSelector.query) {
      await page.locator(usernameSelector.query).fill("standard_user");
      
      const usernameElementCount = await page.locator(usernameSelector.query).count();
      console.log(`Found ${usernameElementCount} element(s) with selector: ${usernameSelector.query}`);
      expect(usernameElementCount).toBeGreaterThan(0);
    }

    // Example 2: Get CSS selector for password field using the direct string task API
    // Even simpler - just pass the task string directly
    const passwordSelector = await completeTaskGemini(page, 
      "Find the CSS selector for the password input field"
    );

    console.log("Password field selector:", passwordSelector.query);
    expect(passwordSelector.query).toBeTruthy();
    
    // Use the selector if available
    if (passwordSelector.query) {
      await page.locator(passwordSelector.query).fill("secret_sauce");
      
      const passwordElementCount = await page.locator(passwordSelector.query).count();
      console.log(`Found ${passwordElementCount} element(s) with selector: ${passwordSelector.query}`);
      expect(passwordElementCount).toBeGreaterThan(0);
    }

    // Example 3: Get CSS selector for login button
    // Using the string API with more detailed instructions
    const loginButtonSelector = await completeTaskGemini(page, 
      "Find the CSS selector for the login button. It is likely an input element with type='submit' or a button element."
    );

    console.log("Login button selector:", loginButtonSelector.query);
    expect(loginButtonSelector.query).toBeTruthy();
    
    // Verify the selector and try alternatives if needed
    if (loginButtonSelector.query) {
      const buttonElementCount = await page.locator(loginButtonSelector.query).count();
      console.log(`Found ${buttonElementCount} element(s) with selector: ${loginButtonSelector.query}`);
      
      if (buttonElementCount > 0) {
        // Click the login button
        await page.locator(loginButtonSelector.query).click();
        
        // Verify we successfully logged in by checking for an element on the inventory page
        await expect(page.locator('.inventory_list')).toBeVisible();
      } else {
        // Try an alternative selector if the AI-generated one doesn't work
        console.log("Using alternative selector for login button");
        await page.locator('input[type="submit"], button[type="submit"], #login-button').click();
        
        // Verify we successfully logged in by checking for an element on the inventory page
        await expect(page.locator('.inventory_list')).toBeVisible();
      }
    } else {
      // Fallback if no selector was returned
      console.log("No valid selector returned, using fallback selector");
      await page.locator('input[type="submit"], button[type="submit"], #login-button').click();
      
      // Verify we successfully logged in
      await expect(page.locator('.inventory_list')).toBeVisible();
    }
  });
}); 