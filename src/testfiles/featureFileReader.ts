import * as fs from 'fs';
import * as path from 'path';

export interface ScenarioStep {
  text: string;     // The actual step text
}

export interface Scenario {
  name: string;
  steps: ScenarioStep[];
}

export class FeatureFileReader {
  /**
   * Read and parse a feature file
   * @param featureFilePath Path to the feature file relative to the project root
   * @returns Array of scenarios found in the feature file
   */
  static readFeatureFile(featureFilePath: string): Scenario[] {
    const fullPath = path.join(process.cwd(), featureFilePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);

    const scenarios: Scenario[] = [];
    let currentScenario: Scenario | null = null;

    for (const line of lines) {
      // Skip feature description lines
      if (line.startsWith('Feature:') || line.startsWith('As a') || 
          line.startsWith('I want') || line.startsWith('So that')) {
        continue;
      }
      
      if (line.startsWith('Scenario:')) {
        // If we were building a scenario, save it
        if (currentScenario && currentScenario.steps.length > 0) {
          scenarios.push(currentScenario);
        }
        
        // Start new scenario
        currentScenario = {
          name: line.replace('Scenario:', '').trim(),
          steps: []
        };
      } else if (currentScenario && line) {
        // Add step to current scenario
        currentScenario.steps.push({
          text: line
        });
      }
    }

    // Don't forget to add the last scenario
    if (currentScenario && currentScenario.steps.length > 0) {
      scenarios.push(currentScenario);
    }

    if (scenarios.length === 0) {
      throw new Error('No valid scenarios found in feature file');
    }

    return scenarios;
  }

  /**
   * Convert a step to a task description
   * @param step The step
   * @returns Task description for the selector cache
   */
  static convertStepToTask(step: ScenarioStep): string {
    return step.text;
  }
} 