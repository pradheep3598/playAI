import { Page } from '@playwright/test';
import { SelectorCache } from '../ai/selectorCache';
import { FeatureFileReader, Scenario, ScenarioStep } from './featureFileReader';
import * as path from 'path';
import * as fs from 'fs';

export class LoginHelper {
  private selectorCache: SelectorCache;
  private options: any;
  private currentScenario: string = '';

  constructor(selectorCache: SelectorCache, options: any) {
    this.selectorCache = selectorCache;
    this.options = options;
  }

  /**
   * Execute login steps from a feature file
   * @param page Playwright page object
   * @param featureFilePath Path to the feature file relative to project root
   * @param scenario Optional specific scenario to run, if not provided runs first scenario
   */
  async executeFeatureSteps(page: Page, featureFilePath: string, scenario?: Scenario): Promise<void> {
    if (!scenario) {
      // If no specific scenario provided, get the first one
      const scenarios = FeatureFileReader.readFeatureFile(featureFilePath);
      scenario = scenarios[0];
    }

    this.currentScenario = scenario.name;
    console.log(`Executing scenario: ${this.currentScenario}`);
    
    for (const step of scenario.steps) {
      console.log(`Executing step: ${step.text}`);

      // Handle different step types based on the step text
      if (step.text.startsWith('Open')) {
        // Extract URL from the step
        const url = step.text.match(/"([^"]+)"/)![1];
        await page.goto(url);
      } else {
        await this.executeStep(page, step);
      }
    }
  }

  private async executeStep(page: Page, step: ScenarioStep): Promise<void> {
    const task = FeatureFileReader.convertStepToTask(step);
    const selector = await this.selectorCache.getOrFindSelector(
      page,
      this.currentScenario,
      task,
      this.options
    );

    console.log(`Found selector: ${selector}`);

    if (task.includes('type')) {
      const textToType = task.match(/type "(.*?)"/)![1];
      await page.locator(selector).fill(textToType);
      
      // Verify the input
      const value = await page.locator(selector).inputValue();
      if (value !== textToType) {
        throw new Error(`Failed to type text. Expected: ${textToType}, Got: ${value}`);
      }
    } else if (task.includes('click')) {
      await page.locator(selector).click();
      
      // If this was a login action, wait for the inventory list
      if (task.includes('login')) {
        await page.locator('.inventory_list').waitFor({ state: 'visible', timeout: 5000 });
      }
    }
  }

  /**
   * Execute login steps from a test file
   * @param page Playwright page object
   * @param testStepsFile Path to the test steps file (relative to src/testfiles)
   */
  async executeLoginSteps(page: Page, testStepsFile: string): Promise<void> {
    // Read test steps from file
    const fullPath = path.join(process.cwd(), 'src', 'testfiles', testStepsFile);
    const testSteps = fs.readFileSync(fullPath, 'utf8').split('\n').filter(step => step.trim());

    // Execute each test step
    for (const step of testSteps) {
      if (!step.trim()) continue;

      console.log(`Executing step: ${step}`);

      // Get selector for the current step
      const selector = await this.selectorCache.getOrFindSelector(
        page,
        "Execute login steps from file",
        step,
        this.options
      );

      console.log(`Found selector: ${selector}`);

      // Execute the step based on its content
      if (step.includes('type')) {
        // Extract the text to type from the step
        const textToType = step.match(/type "(.*?)"/)![1];
        await page.locator(selector).fill(textToType);
        
        // Verify the input
        const value = await page.locator(selector).inputValue();
        if (value !== textToType) {
          throw new Error(`Failed to type text. Expected: ${textToType}, Got: ${value}`);
        }
      } else if (step.includes('click')) {
        await page.locator(selector).click();
        
        // Verify login success if this was the login button
        if (step.includes('login')) {
          await page.locator('.inventory_list').waitFor({ state: 'visible', timeout: 5000 });
        }
      }
    }
  }

  /**
   * Navigate to the login page
   * @param page Playwright page object
   */
  async navigateToLoginPage(page: Page): Promise<void> {
    await page.goto("https://www.saucedemo.com/");
  }
} 