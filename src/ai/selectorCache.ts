import { Page } from '@playwright/test';
import { completeTaskGemini } from './completeTaskGemini';
import * as path from 'path';
import * as fs from 'fs';

export interface TestStep {
  task: string;
  selector: string;
}

export interface TestScenario {
  steps: TestStep[];
}

export class SelectorCache {
  private cache: Map<string, TestScenario> = new Map();
  private filePath: string;
  private static readonly CACHE_DIR = 'test-selectors';

  constructor(testFilePath: string) {
    // Convert test file path to cache file path
    // e.g. "tests/cssSelector.demo.spec.ts" -> "test-selectors/cssSelector_demo_spec_test.json"
    const fileName = path.basename(testFilePath)
      .replace(/\./g, '_')
      .replace(/\.ts$|\.js$/i, '')
      .concat('_test.json');
    
    // Create cache directory if it doesn't exist
    if (!fs.existsSync(SelectorCache.CACHE_DIR)) {
      fs.mkdirSync(SelectorCache.CACHE_DIR, { recursive: true });
    }

    this.filePath = path.join(SelectorCache.CACHE_DIR, fileName);
    this.loadCache();
  }

  private loadCache() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        const jsonData = JSON.parse(data);
        
        // Convert the flat JSON structure to Map
        Object.entries(jsonData).forEach(([testName, scenario]) => {
          this.cache.set(testName, scenario as TestScenario);
        });
      }
    } catch (error) {
      console.error('Error loading selector cache:', error);
    }
  }

  private saveCache() {
    try {
      // Convert Map to a plain object for JSON serialization
      const existingData = fs.existsSync(this.filePath) 
        ? JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
        : {};

      // Merge existing data with new data
      const newData = Object.fromEntries(this.cache);
      const mergedData = { ...existingData, ...newData };

      fs.writeFileSync(this.filePath, JSON.stringify(mergedData, null, 2));
    } catch (error) {
      console.error('Error saving selector cache:', error);
    }
  }

  public async getOrFindSelector(
    page: Page,
    testName: string,
    task: string,
    options: any
  ): Promise<string> {
    // Check if this is a dropdown locating task
    const isDropdownLocator = task.toLowerCase().includes('dropdown');
    
    const scenario = this.cache.get(testName);
    const step = scenario?.steps.find(s => s.task === task);

    if (step) {
      try {
        // Verify the cached selector still works
        const elementCount = await page.locator(step.selector).count();
        if (elementCount > 0) {
          // For dropdown tasks, verify it's a select or has role='combobox'
          if (isDropdownLocator) {
            const isValidDropdown = await page.locator(step.selector).evaluate(el => {
              return el.tagName.toLowerCase() === 'select' || 
                     el.getAttribute('role') === 'combobox' ||
                     el.querySelector('select') !== null;
            });
            if (!isValidDropdown) {
              throw new Error('Cached selector is not a valid dropdown element');
            }
          }
          console.log(`Using cached selector for task: ${task}`);
          return step.selector;
        }
      } catch (error: any) {
        console.log(`Cached selector failed, will request new one: ${error.message}`);
      }
    }

    // If no cache hit or selector failed, get new selector from Gemini
    console.log(`Requesting new selector from Gemini for task: ${task}`);
    const result = await completeTaskGemini(page, {
      task,
      options: {
        ...options,
        elementType: isDropdownLocator ? 'dropdown' : undefined
      }
    });

    if (result.query) {
      // For dropdown tasks, verify the selector finds a valid dropdown
      if (isDropdownLocator) {
        const isValidDropdown = await page.locator(result.query).evaluate(el => {
          return el.tagName.toLowerCase() === 'select' || 
                 el.getAttribute('role') === 'combobox' ||
                 el.querySelector('select') !== null;
        });
        if (!isValidDropdown) {
          throw new Error('Generated selector is not a valid dropdown element');
        }
      }

      // Update cache
      if (!this.cache.has(testName)) {
        this.cache.set(testName, { steps: [] });
      }
      
      const testScenario = this.cache.get(testName)!;
      const stepIndex = testScenario.steps.findIndex(s => s.task === task);
      
      if (stepIndex >= 0) {
        testScenario.steps[stepIndex].selector = result.query;
      } else {
        testScenario.steps.push({ task, selector: result.query });
      }

      this.saveCache();
      return result.query;
    }

    throw new Error(`Failed to get selector for task: ${task}`);
  }
} 