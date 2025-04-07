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
   * Converts a CSS selector to an XPath expression
   * @param cssSelector The CSS selector to convert
   * @returns XPath expression
   */
  private convertCssToXPath(cssSelector: string): string {
    console.log(`Converting CSS selector to XPath: ${cssSelector}`);
    
    try {
      // Parse CSS selector to extract attributes
      const attributeMatches = cssSelector.match(/\[([^\]]+)\]/g) || [];
      const attributePairs = attributeMatches.map((match: string) => {
        // Remove brackets and split by =
        const cleanMatch = match.replace(/^\[|\]$/g, '');
        const parts = cleanMatch.split('=');
        const name = parts[0];
        const valueWithQuotes = parts.length > 1 ? parts[1] : '';
        // Remove quotes from value if they exist
        const value = valueWithQuotes ? valueWithQuotes.replace(/^['"]|['"]$/g, '') : '';
        return { name, value };
      });
      
      // Build XPath from extracted attributes
      if (attributePairs.length > 0) {
        const tagMatch = cssSelector.match(/^([a-zA-Z0-9]+)/);
        const tagName = tagMatch ? tagMatch[1] : '*';
        let xpathSelector = `//${tagName}`;
        
        // Add attributes to XPath
        attributePairs.forEach(({ name, value }: { name: string; value: string }) => {
          xpathSelector += `[@${name}='${value}']`;
        });
        
        console.log(`Converted to XPath: ${xpathSelector}`);
        return xpathSelector;
      }
    } catch (error) {
      console.log(`Error converting CSS to XPath: ${error}`);
    }
    
    // Return a default XPath if conversion fails
    return `//*[contains(@class, "${cssSelector}")]`;
  }

  /**
   * Find parent interactive element from a given element
   * @param context The page or frame locator context
   * @param xpathSelector The XPath selector for the element
   * @returns An XPath that targets the parent interactive element
   */
  private async findParentInteractiveElement(element: any, xpathSelector: string): Promise<string> {
    try {
      // Check if the element is already an interactive element
      const isInteractiveElement = await element.evaluate((el: HTMLElement) => {
        const tag = el.tagName.toLowerCase();
        return (
          tag === 'select' || 
          tag === 'input' || 
          (tag === 'div' && el.getAttribute('role') === 'listbox') ||
          (tag === 'div' && el.getAttribute('role') === 'combobox') ||
          (tag === 'ul' && el.getAttribute('role') === 'listbox') ||
          tag === 'button' ||
          (tag === 'a' && el.hasAttribute('href'))
        );
      }).catch(() => false);
      
      if (isInteractiveElement) {
        return xpathSelector;
      }
      
      // Try to find the parent interactive element
      // This covers standard elements and custom dropdown components
      const parentXPath = `(${xpathSelector})/ancestor::*[self::select or self::div[@role="listbox"] or self::div[@role="combobox"] or self::ul[@role="listbox"] or self::div[contains(@class, "dropdown") or contains(@class, "select")] or self::*[.//option]][1]`;
      return parentXPath;
    } catch (error) {
      console.log(`Error finding parent interactive element: ${error}`);
      return xpathSelector; // Return original if anything goes wrong
    }
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

  /**
   * Check if an element is inside an iframe, including nested iframes
   * @param page Playwright page object
   * @param selector CSS selector to check
   * @returns Object containing isInIframe (boolean), frameSelector (string if found), and nestedFrameSelector (string if in nested frame)
   */
  private async isElementInIframe(page: Page, selector: string): Promise<{ 
    isInIframe: boolean; 
    frameSelector?: string;
    nestedFrameSelector?: string;
  }> {
    try {
      // First check if element exists in main document
      const elementInMain = await page.$(selector);
      if (elementInMain) {
        return { isInIframe: false };
      }

      // If not in main document, check all iframes recursively
      const result = await page.evaluate(async (sel) => {
        // Helper function to get unique selector for an iframe
        const getIframeSelector = (iframe: HTMLIFrameElement): string => {
          if (iframe.id) return `iframe#${iframe.id}`;
          if (iframe.name) return `iframe[name="${iframe.name}"]`;
          if (iframe.src) return `iframe[src="${iframe.src}"]`;
          
          // If no unique attributes, get nth-child selector
          const parent = iframe.parentElement;
          if (parent) {
            const iframes = Array.from(parent.getElementsByTagName('iframe'));
            const index = iframes.indexOf(iframe);
            return `iframe:nth-child(${index + 1})`;
          }
          return 'iframe';
        };

        // Recursive function to check iframes and their nested iframes
        const checkIframeRecursively = async (iframe: HTMLIFrameElement): Promise<{
          found: boolean;
          frameSelector?: string;
          nestedFrameSelector?: string;
        }> => {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!iframeDoc) return { found: false };

            // Check if element exists directly in this iframe
            const elementInFrame = iframeDoc.querySelector(sel);
            if (elementInFrame) {
              return {
                found: true,
                frameSelector: getIframeSelector(iframe)
              };
            }

            // If not found, check nested iframes
            const nestedIframes = Array.from(iframeDoc.getElementsByTagName('iframe'));
            for (const nestedIframe of nestedIframes) {
              const nestedResult = await checkIframeRecursively(nestedIframe);
              if (nestedResult.found) {
                return {
                  found: true,
                  frameSelector: getIframeSelector(iframe),
                  nestedFrameSelector: nestedResult.frameSelector
                };
              }
            }
          } catch (e) {
            console.log(`Could not access iframe content: ${e}`);
          }
          return { found: false };
        };

        // Get all top-level iframes in the document
        const iframes = Array.from(document.getElementsByTagName('iframe'));
        
        // Check each iframe recursively
        for (const iframe of iframes) {
          const result = await checkIframeRecursively(iframe);
          if (result.found) {
            return result;
          }
        }
        return { found: false };
      }, selector);

      return {
        isInIframe: result?.found || false,
        frameSelector: result?.frameSelector,
        nestedFrameSelector: result?.nestedFrameSelector
      };
    } catch (error) {
      console.error(`Error checking if element is in iframe: ${error}`);
      return { isInIframe: false };
    }
  }

  /**
   * Execute a single step from a scenario
   * @param page Playwright page object
   * @param step Step from a scenario
   */
  private async executeStep(page: Page, step: ScenarioStep): Promise<void> {
    const task = FeatureFileReader.convertStepToTask(step);
    console.log(`Executing step: ${task}`);
    
    // Get selector from cache
    const selector = await this.selectorCache.getOrFindSelector(
      page,
      this.currentScenario,
      task,
      this.options
    );
    console.log(`Retrieved selector from cache: ${selector}`);

    // Parse the selector and handle iframes
    let elementSelector = selector;
    let frameLocator = null;
    let updatedSelector = "";
    let noNeedToWait = false;

    if (selector.includes('>') && !selector.includes('>>')) {
      let selectorArray = selector.split('>');
      updatedSelector = selectorArray[selectorArray.length - 1].trim();
      elementSelector = updatedSelector;
      noNeedToWait = true;
      console.log(`Using last part of selector with ">": ${elementSelector}`);
    } else if (selector.includes('>>')) {
      console.log(`Iframe selector detected: ${selector}`);
      // Apply iframe handling logic
      const selectorArray = selector.split('>>').map(part => part.trim());
      const len = selectorArray.length;
      
      // Last element is our desired locator
      elementSelector = selectorArray[len - 1];
      
      // Build frame locator chain for nested iframes
      if (len > 1) {
        let grandParentFrame = null;
        let parentFrame = null;
        
        for (let i = 0; i < len - 1; i++) {
          if (i === 0) {
            // First frame (outermost)
            grandParentFrame = page.frameLocator(selectorArray[i]);
          } else if (i === 1 && grandParentFrame) {
            // Second frame (if exists)
            parentFrame = grandParentFrame.frameLocator(selectorArray[i]);
          } else if (parentFrame) {
            // Handle deeper nesting if needed (more than 2 levels)
            parentFrame = parentFrame.frameLocator(selectorArray[i]);
          }
        }
        
        // Determine which frame locator to use for the element
        if (len === 2) {
          // Only one iframe level
          frameLocator = grandParentFrame;
        } else {
          // Multiple iframe levels
          frameLocator = parentFrame;
        }
      }
    }

    // Now proceed with the elementSelector we've determined
    console.log(`Using element selector: ${elementSelector}`);
    console.log(`Frame context: ${frameLocator ? 'Yes (in iframe)' : 'No (main document)'}`);
    
    try {
      // Extract text within quotes if present (for input values)
      const quotedText = task.match(/"([^"]+)"|'([^']+)'/)?.[ 1 ] || '';
      
      // Get the element locator (either in frame or main page
      const element = frameLocator ? frameLocator.locator(elementSelector) : page.locator(elementSelector);
      
      try {
        // Wait for element with timeout
        if (!noNeedToWait) {
        await element.waitFor({ timeout: 5000, state: 'visible' });
        }
        console.log(`Element found in ${frameLocator ? 'iframe' : 'main document'}`);
        
        // Handle different action types
        if (task.toLowerCase().includes('click')) {
          await element.click();
          
          // If this was a login action, wait for the inventory list
          if (task.includes('login')) {
            await page.locator('.inventory_list').waitFor({ state: 'visible', timeout: 5000 });
          }
        } 
        // Handle dropdown selection
        else if (task.toLowerCase().match(/\b(select|choose)\b/i) && (task.toLowerCase().includes('drop down') || task.toLowerCase().includes('dropdown'))) {
          if (!quotedText) {
            throw new Error(`No option value provided for dropdown selection in step: ${task}`);
          }
          
          // Extract attributes and build XPath
          let xpathSelector = this.convertCssToXPath(elementSelector);
              
          try {
            // Find appropriate parent interactive element (not just select)
            const parentXPath = `${xpathSelector}/parent::*`;
            console.log(`Parent interactive element XPath: ${parentXPath}`);
            
            const context = frameLocator || page;
            const interactiveElement = context.locator(`xpath=${parentXPath}`);
            
            // Wait for the element with a short timeout
            await interactiveElement.waitFor({ timeout: 2000 });
            console.log('Found interactive parent element');
            
            // Determine if it's a standard select or custom dropdown
            const elementType = await interactiveElement.evaluate((el: HTMLElement) => {
              return {
                tagName: el.tagName.toLowerCase(),
                role: el.getAttribute('role'),
                hasOptions: el.querySelectorAll('option').length > 0,
                hasListItems: el.querySelectorAll('li').length > 0
              };
            }).catch(() => ({ tagName: 'unknown', role: null, hasOptions: false, hasListItems: false }));
            
            console.log('Interactive element details:', elementType);
            
            // Handle different types of dropdowns
            if (elementType.tagName === 'select' || elementType.hasOptions) {
              // Standard select element
              console.log('Handling standard select element');
              await interactiveElement.selectOption({ label: quotedText });
            } else if (elementType.role === 'listbox' || elementType.role === 'combobox' || elementType.hasListItems) {
              // Custom dropdown implementation
              console.log('Handling custom dropdown component');
              // First click to open the dropdown
              await interactiveElement.click();
              await page.waitForTimeout(500); // Wait for dropdown to open
              
              // Then find and click the option with the matching text
              const optionXPath = `//*[text()="${quotedText}" or contains(text(), "${quotedText}") or @value="${quotedText}" or contains(@class, "option") and contains(text(), "${quotedText}")]`;
              const optionSelector = context.locator(`xpath=${optionXPath}`);
              await optionSelector.click();
            } else {
              // Fallback to just clicking and hoping for the best
              console.log('Using fallback handling for unknown dropdown type');
              await interactiveElement.click();
              await page.waitForTimeout(500);
              
              // Try to find any element that matches the text we want to select
              const optionXPath = `//*[text()="${quotedText}" or contains(text(), "${quotedText}")]`;
              const optionSelector = context.locator(`xpath=${optionXPath}`);
              await optionSelector.click();
            }
            
            console.log(`Selected option: ${quotedText}`);
          } catch (error) {
            console.log(`Error handling dropdown: ${error}, falling back to basic approach`);
            // Fallback to original element and basic selectOption
            await element.selectOption({ label: quotedText, value: quotedText });
          }
        }
        // Handle input actions (type, enter, fill)
        else if (task.toLowerCase().match(/\b(type|enter|fill)\b/)) {
          if (!quotedText) {
            throw new Error(`No text provided for input action in step: ${task}`);
          }
          
          // Handle date inputs
          const isDateInput = await element.evaluate((el) => {
            return el.tagName.toLowerCase() === 'input' && el.getAttribute('type') === 'date';
          }).catch(() => false);
          
          if (isDateInput) {
            console.log('Date input detected, converting format...');
            
            // Convert date format from DD/MM/YYYY to YYYY-MM-DD
            const dateRegex = /(\d{2})\/(\d{2})\/(\d{4})/;
            const match = quotedText.match(dateRegex);
            
            if (match) {
              const day = match[1];
              const month = match[2];
              const year = match[3];
              const isoDate = `${year}-${month}-${day}`;
              
              console.log(`Converting date format from ${quotedText} to ${isoDate}`);
              await element.fill(isoDate);
              
              // Verify the input
              const value = await element.inputValue();
              console.log(`Date field value after setting: ${value}`);
            } else {
              // If not in expected format, try to use as is
              await element.fill(quotedText);
            }
          } else {
            // Regular text input handling
            // Check for existing text
            const existingText = await element.inputValue();
            console.log('Existing text in field:', existingText);
            
            if (existingText) {
              // If text exists, append the new text
              const combinedText = existingText + quotedText;
              await element.fill(combinedText);
              console.log(`Appended text. New value: ${combinedText}`);
              
              // Verify the appended input
              const newValue = await element.inputValue();
              if (newValue !== combinedText) {
                throw new Error(`Failed to append text. Expected: ${combinedText}, Got: ${newValue}`);
              }
            } else {
              // If no existing text, use fill
              await element.fill(quotedText);
              console.log(`Filled text: ${quotedText}`);
              
              // Verify the input
              const value = await element.inputValue();
              if (value !== quotedText) {
                throw new Error(`Failed to type text. Expected: ${quotedText}, Got: ${value}`);
              }
            }
          }
        }
        // Handle hover action
        else if (task.toLowerCase().includes('hover')) {
          await element.hover();
          
          // Wait for any hover effects to be visible
          await page.waitForTimeout(500);
        }
        else {
          throw new Error(`Unsupported action in step: ${task}`);
        }
      } catch (error: any) {
        console.error(`Failed to perform action: ${error.message}`);
        throw error;
      }
      
      // Add a small delay between steps for stability
      await page.waitForTimeout(100);
      
    } catch (error: any) {
      console.error(`Failed to execute step: ${task}`);
      console.error(`Error: ${error.message}`);
      throw error;
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
    await page.goto("https://letcode.in/test");
  }

  /**
   * Handle different types of alerts
   * @param page Playwright page object
   * @param action 'accept' or 'dismiss' or 'type "text"'
   * @param alertType Optional alert type ('alert', 'confirm', or 'prompt'), defaults to any alert
   */
  async handleAlert(page: Page, action: string, alertType?: string): Promise<void> {
    try {
      // Create dialog handler based on action
      page.on('dialog', async dialog => {
        console.log(`Handling ${dialog.type()} dialog with message: ${dialog.message()}`);

        // If alertType is specified, verify it matches
        if (alertType && !dialog.type().includes(alertType.toLowerCase())) {
          throw new Error(`Expected ${alertType} dialog but got ${dialog.type()} dialog`);
        }

        if (action.toLowerCase().includes('type')) {
          // Extract text to type (text within quotes)
          const textMatch = action.match(/"([^"]+)"|'([^']+)'/);
          if (!textMatch) {
            throw new Error('No text provided for prompt dialog');
          }
          const textToType = textMatch[1] || textMatch[2];
          await dialog.accept(textToType);
        } else if (action.toLowerCase().includes('accept')) {
          await dialog.accept();
        } else if (action.toLowerCase().includes('dismiss')) {
          await dialog.dismiss();
        } else {
          throw new Error(`Unknown alert action: ${action}`);
        }
      });

    } catch (error: any) {
      console.error(`Failed to handle alert: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute a single step without needing a file
   * @param page Playwright page object
   * @param step Step to execute (e.g., "type 'admin123' in password field" or "click login button")
   * @param testName Optional name for caching selectors (defaults to "Execute single step")
   * @param desiredSelector Optional CSS selector to use (if provided, won't use the selector cache)
   * 
   * @example
   * // Using the selector cache (automatic selector detection)
   * await loginHelper.executeSingleStep(page, "type 'admin123' in password field");
   * 
   * // Using the selector cache with a custom test name
   * await loginHelper.executeSingleStep(page, "type 'admin123' in password field", "Login Form Test");
   * 
   * // Using a specific selector (bypassing the cache)
   * await loginHelper.executeSingleStep(page, "type 'admin123' in password field", "Login Form Test", "#password");
   * 
   * // IMPORTANT: When calling with 3 parameters where the 3rd is a selector, pass undefined as the test name
   * await loginHelper.executeSingleStep(page, "type 'admin123' in password field", undefined, "#password");
   */
  async executeSingleStep(page: Page, step: string, testName: string | undefined = "Execute single step", desiredSelector?: string): Promise<void> {
    if (!step.trim()) {
      throw new Error("Step cannot be empty");
    }

    console.log(`Executing step: ${step}`);
    console.log(`Test name: ${testName}`);
    console.log(`Desired selector provided: ${desiredSelector ? 'Yes' : 'No'}`);
    
    // Check if testName is actually a selector (parameter mixing)
    if (typeof testName === 'string' && (testName.includes('#') || testName.includes('.') || testName.includes('[') || testName.includes('>>') || testName.includes('iframe'))) {
      console.log('Detected selector in testName parameter, moving to desiredSelector');
      desiredSelector = testName;
      testName = "Execute single step";
    }

    // Handle alert-related steps
    if (step.toLowerCase().includes('alert')) {
      const alertType = step.toLowerCase().includes('confirm') ? 'confirm' : 
                       step.toLowerCase().includes('prompt') ? 'prompt' : 'alert';
      
      if (step.toLowerCase().includes('accept')) {
        await this.handleAlert(page, 'accept', alertType);
        return;
      } else if (step.toLowerCase().includes('dismiss')) {
        await this.handleAlert(page, 'dismiss', alertType);
        return;
      } else if (step.toLowerCase().includes('type')) {
        await this.handleAlert(page, step, alertType);
        return;
      }
    }

    // Parse the selector and handle iframes
    let selector = '';
    let frameLocator = null;
    
    if (desiredSelector) {
      console.log(`Using provided selector: ${desiredSelector}`);
      
      // Process the selector using if it contains ">" but not ">>"
      if (desiredSelector.includes('>') && !desiredSelector.includes('>>')) {
        const originalSelector = desiredSelector;
        desiredSelector = desiredSelector.split('>').map(part => part.trim())[desiredSelector.split('>').length - 1];
        console.log(`Processed selector from "${originalSelector}" to "${desiredSelector}"`);
      }
      
      if (desiredSelector.includes('>>')) {
        // Split the selector by >> to handle iframe structure
        const selectorArray = desiredSelector.split('>>').map(part => part.trim());
        const len = selectorArray.length;
        
        // Last element is our desired locator
        selector = selectorArray[len - 1];
        
        // Build frame locator chain for nested iframes
        if (len > 1) {
          let grandParentFrame = null;
          let parentFrame = null;
          
          for (let i = 0; i < len - 1; i++) {
            if (i === 0) {
              // First frame (outermost)
              grandParentFrame = page.frameLocator(selectorArray[i]);
            } else if (i === 1 && grandParentFrame) {
              // Second frame (if exists)
              parentFrame = grandParentFrame.frameLocator(selectorArray[i]);
            } else if (parentFrame) {
              // Handle deeper nesting if needed (more than 2 levels)
              parentFrame = parentFrame.frameLocator(selectorArray[i]);
            }
          }
          
          // Determine which frame locator to use for the element
          if (len === 2) {
            // Only one iframe level
            frameLocator = grandParentFrame;
          } else {
            // Multiple iframe levels
            frameLocator = parentFrame;
          }
        }
      } else {
        // No iframes, just a regular selector
        selector = desiredSelector;
      }
    } else {
      // Get selector from cache if not provided
      console.log(`No selector provided, attempting to fetch from cache with test name: "${testName}"`);
      try {
        selector = await this.selectorCache.getOrFindSelector(
          page,
          testName || "Execute single step",
          step,
          this.options
        );
        console.log(`Retrieved selector from cache: ${selector}`);
      } catch (error) {
        console.error(`Failed to get selector from cache: ${error}`);
        throw new Error(`Failed to get selector for step: ${step}. Error: ${error}`);
      }
      
      // Check if retrieved selector has iframe paths
      if (selector.includes('>>')) {
        // Apply the same iframe handling logic for cached selectors
        const selectorArray = selector.split('>>').map(part => part.trim());
        const len = selectorArray.length;
        
        // Last element is our desired locator
        selector = selectorArray[len - 1];
        
        // Build frame locator chain for nested iframes
        if (len > 1) {
          let grandParentFrame = null;
          let parentFrame = null;
          
          for (let i = 0; i < len - 1; i++) {
            if (i === 0) {
              // First frame (outermost)
              grandParentFrame = page.frameLocator(selectorArray[i]);
            } else if (i === 1 && grandParentFrame) {
              // Second frame (if exists)
              parentFrame = grandParentFrame.frameLocator(selectorArray[i]);
            } else if (parentFrame) {
              // Handle deeper nesting if needed (more than 2 levels)
              parentFrame = parentFrame.frameLocator(selectorArray[i]);
            }
          }
          
          // Determine which frame locator to use for the element
          if (len === 2) {
            // Only one iframe level
            frameLocator = grandParentFrame;
          } else {
            // Multiple iframe levels
            frameLocator = parentFrame;
          }
        }
      }
    }

    console.log(`Using selector: ${selector}`);
    console.log(`Frame context: ${frameLocator ? 'Yes (in iframe)' : 'No (main document)'}`);
    
    try {
      // Extract text within quotes if present (for input values)
      const quotedText = step.match(/"([^"]+)"|'([^']+)'/)?.[ 1 ] || '';
      
      // Get the element locator (either in frame or main page)
      const element = frameLocator ? frameLocator.locator(selector) : page.locator(selector);
      
      try {
        // Wait for element with timeout
        await element.waitFor({ timeout: 5000, state: 'visible' });
        console.log(`Element found in ${frameLocator ? 'iframe' : 'main document'}`);
        
        // Handle different action types
        if (step.toLowerCase().match(/\b(type|enter|fill)\b/)) {
          if (!quotedText) {
            throw new Error(`No text provided for input action in step: ${step}`);
          }
          
          // Check for existing text
          const existingText = await element.inputValue();
          console.log('Existing text in field:', existingText);
          
          if (existingText) {
            const combinedText = existingText + quotedText;
            await element.fill(combinedText);
            console.log(`Appended text. New value: ${combinedText}`);
            
            const newValue = await element.inputValue();
            if (newValue !== combinedText) {
              throw new Error(`Failed to append text. Expected: ${combinedText}, Got: ${newValue}`);
            }
          } else {
            await element.fill(quotedText);
            console.log(`Filled text: ${quotedText}`);
            
            const value = await element.inputValue();
            if (value !== quotedText) {
              throw new Error(`Failed to type text. Expected: ${quotedText}, Got: ${value}`);
            }
          }
        }
        else if (step.toLowerCase().includes('click')) {
          await element.click();
          
          if (step.toLowerCase().includes('login')) {
            await page.locator('.inventory_list').waitFor({ state: 'visible', timeout: 5000 });
          }
        }
        else if (step.toLowerCase().match(/\b(select|choose)\b/i) && step.toLowerCase().includes('dropdown')) {
          if (!quotedText) {
            throw new Error(`No option value provided for dropdown selection in step: ${step}`);
          }
          
          // Extract the element selector from the current context
          const targetSelector = selector; // Use the determined selector
          
          // Extract attributes and build XPath
          let xpathSelector = this.convertCssToXPath(targetSelector);
          
          // Use the XPath selector if available, otherwise fall back to the original element
          let parentElement = element;
          
          try {
            // Find appropriate parent interactive element (not just select)
            const parentXPath = await this.findParentInteractiveElement(element, xpathSelector);
            console.log(`Parent interactive element XPath: ${parentXPath}`);
            
            const context = frameLocator || page;
            const interactiveElement = context.locator(`xpath=${parentXPath}`);
            
            // Wait for the element with a short timeout
            await interactiveElement.waitFor({ timeout: 2000 });
            console.log('Found interactive parent element');
            
            // Determine if it's a standard select or custom dropdown
            const elementType = await interactiveElement.evaluate((el: HTMLElement) => {
              return {
                tagName: el.tagName.toLowerCase(),
                role: el.getAttribute('role'),
                hasOptions: el.querySelectorAll('option').length > 0,
                hasListItems: el.querySelectorAll('li').length > 0
              };
            }).catch(() => ({ tagName: 'unknown', role: null, hasOptions: false, hasListItems: false }));
            
            console.log('Interactive element details:', elementType);
            
            // Handle different types of dropdowns
            if (elementType.tagName === 'select' || elementType.hasOptions) {
              // Standard select element
              console.log('Handling standard select element');
              await interactiveElement.selectOption({ label: quotedText });
            } else if (elementType.role === 'listbox' || elementType.role === 'combobox' || elementType.hasListItems) {
              // Custom dropdown implementation
              console.log('Handling custom dropdown component');
              // First click to open the dropdown
              await interactiveElement.click();
              await page.waitForTimeout(500); // Wait for dropdown to open
              
              // Then find and click the option with the matching text
              const optionXPath = `//*[text()="${quotedText}" or contains(text(), "${quotedText}") or @value="${quotedText}" or contains(@class, "option") and contains(text(), "${quotedText}")]`;
              const optionSelector = context.locator(`xpath=${optionXPath}`);
              await optionSelector.click();
            } else {
              // Fallback to just clicking and hoping for the best
              console.log('Using fallback handling for unknown dropdown type');
              await interactiveElement.click();
              await page.waitForTimeout(500);
              
              // Try to find any element that matches the text we want to select
              const optionXPath = `//*[text()="${quotedText}" or contains(text(), "${quotedText}")]`;
              const optionSelector = context.locator(`xpath=${optionXPath}`);
              await optionSelector.click();
            }
            
            console.log(`Selected option: ${quotedText}`);
          } catch (error) {
            console.log(`Error handling dropdown: ${error}, falling back to basic approach`);
            // Fallback to original element and basic selectOption
            await element.selectOption({ label: quotedText, value: quotedText });
          }
        } 
        else if (step.toLowerCase().includes('hover')) {
          await element.hover();
          await page.waitForTimeout(500);
        }
        else {
          throw new Error(`Unsupported action in step: ${step}`);
        }
      } catch (error: any) {
        console.error(`Failed to perform action: ${error.message}`);
        throw error;
      }
      
      // Add a small delay between actions for stability
      await page.waitForTimeout(100);
      
    } catch (error: any) {
      console.error(`Failed to execute step: ${step}`);
      console.error(`Error: ${error.message}`);
      throw error;
    }
  }
} 