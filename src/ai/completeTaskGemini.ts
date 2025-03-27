import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerativeModel, Tool, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { type Page, TaskMessage, TaskResult } from "./types";
import { prompt } from "./prompt";
import { createActionsGemini } from "./createActionsGemini";
import { getSnapshot } from "./getSnapshot";

const defaultDebug = process.env.PLAY_AI_DEBUG === "true";

/**
 * Gets a CSS selector from Google's Gemini API without performing browser actions.
 *
 * This function sends a prompt to Gemini and asks it to return a CSS selector
 * for the described element, without actually executing actions on the page.
 * It handles getting the page snapshot internally.
 *
 * @param page - The Playwright `Page` object (used for getting the snapshot).
 * @param task - The task message or simplified task object with just a task description.
 * @returns A promise that resolves to the task result containing the CSS selector.
 *
 * @example
 * ```typescript
 * import { completeTaskGemini } from "./completeTaskGemini";
 * import { Page } from "playwright";
 *
 * const page: Page = ...; // Initialize Playwright page
 *
 * // Full TaskMessage approach
 * const result1 = await completeTaskGemini(page, {
 *   task: "Find the CSS selector for the Username field",
 *   options: {
 *     geminiApiKey: "your-api-key",
 *     model: "gemini-2.0-flash-exp",
 *     debug: true,
 *   }
 * });
 *
 * // Simplified approach - snapshot is captured automatically
 * const result2 = await completeTaskGemini(page, "Find the CSS selector for the Password field");
 *
 * console.log(result1.query); // This will be the CSS selector
 * console.log(result2.query); // This will be the CSS selector
 * ```
 */
export const completeTaskGemini = async (
    page: Page,
    taskOrMessage: string | string[] | TaskMessage
): Promise<TaskResult> => {
    // Process the input to handle both full TaskMessage objects and simple string tasks
    let taskMessage: TaskMessage;
    
    if (typeof taskOrMessage === 'string' || Array.isArray(taskOrMessage)) {
        // Handle case where only the task string/array is provided
        taskMessage = {
            task: taskOrMessage,
            options: undefined
        };
    } else {
        // Handle full TaskMessage object
        taskMessage = taskOrMessage;
    }
    
    // Get a fresh page snapshot if one wasn't provided
    if (!taskMessage.snapshot) {
        taskMessage.snapshot = await getSnapshot(page);
    }
    
    // Initialize the Google Generative AI with the provided API key
    const apiKey = taskMessage.options?.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("Gemini API key is required. Set it in options or as GEMINI_API_KEY environment variable.");
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Get the Gemini model
    const modelName = taskMessage.options?.model || "gemini-2.0-flash-exp";
    const model = genAI.getGenerativeModel({ 
        model: modelName,
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
            }
        ]
    });

    const debug = taskMessage.options?.debug ?? defaultDebug;

    // Create a modified prompt for getting CSS selectors
    const selectorPrompt = `Based on the following webpage and task, provide a CSS selector that would uniquely identify the element described in the task. Do not perform any actions, just return the selector.

Task: ${typeof taskMessage.task === 'string' ? taskMessage.task : taskMessage.task.join('\n')}

Webpage snapshot:

\`\`\`
${taskMessage.snapshot.dom}
\`\`\`

Please provide only the CSS selector, nothing else.`;
    
    // Send the prompt to Gemini
    const result = await model.generateContent(selectorPrompt);
    const text = result.response.text();
    
    if (debug) {
        console.log("> Response", text);
    }
    
    // Clean up the response to get just the CSS selector
    // Remove any markdown code blocks, quotes, or explanatory text
    let cssSelector = text
        .replace(/```css/g, "")
        .replace(/```/g, "")
        .replace(/`/g, "")
        .replace(/^.*selector:.*$/mi, "")
        .trim();
    
    // If the response contains multiple lines, try to extract just the selector
    if (cssSelector.includes("\n")) {
        // Try to find a line that looks like a CSS selector (contains typical selector characters)
        const lines = cssSelector.split("\n").map(line => line.trim());
        const selectorLine = lines.find(line => 
            line.match(/[#\.\[\]='"~>+]/) && 
            !line.includes("I recommend") && 
            !line.includes("You can use") &&
            !line.includes("Here is") &&
            !line.startsWith("CSS Selector:") &&
            line.length > 0);
        
        if (selectorLine) {
            cssSelector = selectorLine;
        } else {
            // Just use the first non-empty line
            cssSelector = lines.find(line => line.length > 0) || "";
        }
    }
    
    if (debug) {
        console.log("> Extracted CSS Selector:", cssSelector);
    }
    
    // Return the extracted CSS selector
    return { query: cssSelector };
};

/**
 * Converts the properties object to a format compatible with Gemini's API
 */
function convertPropertiesToGeminiFormat(properties: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(properties)) {
        result[key] = {
            ...value,
            type: convertTypeToGeminiFormat(value.type)
        };
    }
    
    return result;
}

/**
 * Converts JavaScript/JSON type names to Gemini's expected format
 */
function convertTypeToGeminiFormat(type: string): SchemaType {
    switch (type.toLowerCase()) {
        case 'string':
            return SchemaType.STRING;
        case 'number':
            return SchemaType.NUMBER;
        case 'boolean':
            return SchemaType.BOOLEAN;
        case 'object':
            return SchemaType.OBJECT;
        case 'array':
            return SchemaType.ARRAY;
        default:
            return SchemaType.STRING;
    }
} 