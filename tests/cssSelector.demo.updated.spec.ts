import { expect, test } from "@playwright/test";
import { SelectorCache } from "../src/ai/selectorCache";
import { LoginHelper } from "../src/testfiles/loginHelper";
import { FeatureFileReader } from "../src/testfiles/featureFileReader";
import * as path from "path";
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

  // Get scenarios from feature file
  const featureFile = 'tests/features/basic.feature';
  const scenarios = FeatureFileReader.readFeatureFile(featureFile);
  
  // Create a test for each scenario - they will run in parallel
  for (const scenario of scenarios) {
    test(`${scenario.name} [${path.basename(featureFile)}]`, async ({ page }) => {
      // Skip the test if no Gemini API key is provided
      if (!geminiApiKey) {
        test.skip();
        return;
      }

      console.log(`Executing scenario: ${scenario.name}`);
      // Execute steps for this specific scenario
      await loginHelper.executeFeatureSteps(page, featureFile, scenario);
    });
  }
}); 