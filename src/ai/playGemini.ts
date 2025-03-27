import { MAX_TASK_CHARS } from "./config";
import { type Page, type Test, StepOptions } from "./types";
import { completeTaskGemini } from "./completeTaskGemini";
import { getSnapshot } from "./getSnapshot";
import { UnimplementedError } from "./errors";

// Extended options that include Gemini-specific settings
export interface GeminiStepOptions extends StepOptions {
    geminiApiKey?: string;
}

/**
 * Executes a task or a series of tasks using Playwright and Google's Gemini API integration.
 *
 * This function allows you to execute a single task or an array of tasks on a Playwright `page` using Gemini's capabilities.
 * It can be used within a Playwright test context to perform automated actions and assertions.
 *
 * @param task - A single task or an array of tasks to be executed. Each task is a string describing the action to be performed.
 * @param config - Configuration object containing the Playwright `page` and optional `test` context.
 * @param config.page - The Playwright `page` object where the tasks will be executed.
 * @param config.test - Optional Playwright `test` context for running the tasks within a test step.
 * @param options - Optional configuration for the task execution, including Gemini settings.
 * @param options.model - The Gemini model to be used for task execution (default is "gemini-2.0-flash-exp").
 * @param options.debug - Boolean flag to enable debugging mode (default is false).
 * @param options.geminiApiKey - The API key for accessing Google's Gemini services.
 * @returns A promise that resolves with the result of the task execution. The result can include assertions, queries, or other outputs.
 * @throws {UnimplementedError} If the required `page` argument is missing in the config.
 * @throws {Error} If the task length exceeds the maximum allowed characters.
 *
 * @example
 * ```typescript
 * import { playGemini } from "./playGemini";
 * import { Page, Test } from "playwright";
 *
 * const page: Page = ...; // Initialize Playwright page
 * const test: Test = ...; // Initialize Playwright test context
 *
 * await playGemini("Type 'standard_user' in the Username field", { page, test });
 * await playGemini("Click the Login button", { page, test });
 * ```
 */
export const playGemini = async (
    task: string | string[],
    config: { page: Page; test: Test },
    options?: GeminiStepOptions
): Promise<any> => {
    if (!config || !config.page) {
        throw new UnimplementedError(
            "The playGemini() function is missing the required `{ page }` argument."
        );
    }

    const { test, page } = config as { test?: Test; page: Page };

    if (!test) {
        return await runTask(task, page, options);
    }

    return test.step(`play-ai-gemini '${task}'`, async () => {
        const result = await runTask(task, page, options);

        if (result.errorMessage) {
            throw new UnimplementedError(result.errorMessage);
        }

        if (result.assertion !== undefined) {
            return result.assertion;
        }

        if (result.query) {
            return result.query;
        }
        return undefined;
    });
};

/**
 * Runs a task or a series of tasks on the provided Playwright `page` using Gemini.
 *
 * This helper function is responsible for executing the given tasks on the Playwright `page`. It handles the task execution
 * logic, including checking the task length and calling the `completeTaskGemini` function with the necessary parameters.
 *
 * @param task - A single task or an array of tasks to be executed. Each task is a string describing the action to be performed.
 * @param page - The Playwright `page` object where the tasks will be executed.
 * @param options - Optional configuration for the task execution, including Gemini settings.
 * @returns A promise that resolves with the result of the task execution. The result can include assertions, queries, or other outputs.
 * @throws {Error} If the task length exceeds the maximum allowed characters.
 */
async function runTask(
    task: string | string[],
    page: Page,
    options: GeminiStepOptions | undefined
) {
    if (task.length > MAX_TASK_CHARS) {
        throw new Error(
            `The task is too long. The maximum number of characters is ${MAX_TASK_CHARS}.`
        );
    }

    const result = await completeTaskGemini(page, {
        task,
        snapshot: await getSnapshot(page),
        options: options
            ? {
                  model: options.model ?? "gemini-2.0-flash-exp",
                  debug: options.debug ?? false,
                  geminiApiKey: options.geminiApiKey
              }
            : undefined
    });
    return result;
} 