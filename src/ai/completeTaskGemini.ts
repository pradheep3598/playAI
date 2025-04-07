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
        taskMessage = {
            task: taskOrMessage,
            options: undefined
        };
    } else {
        taskMessage = taskOrMessage;
    }
    
    // Get a fresh page snapshot if one wasn't provided, including iframe content
    if (!taskMessage.snapshot) {
        // First get the main document snapshot
        const mainSnapshot = await getSnapshot(page);
        
        // Then get content from all iframes
        const iframeContent = await page.evaluate(() => {
            const getIframeContent = (iframe: HTMLIFrameElement, parentSelectors: string[] = []): { selector: string; content: string; fullPath: string }[] => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (!doc) return [];

                    // Get a unique selector for this iframe
                    let selector = '';
                    if (iframe.id) selector = `iframe#${iframe.id}`;
                    else if (iframe.name) selector = `iframe[name="${iframe.name}"]`;
                    else if (iframe.src) selector = `iframe[src="${iframe.src}"]`;
                    else {
                        // Get nth-child selector as fallback
                        const parent = iframe.parentElement;
                        if (parent) {
                            const iframes = Array.from(parent.getElementsByTagName('iframe'));
                            const index = iframes.indexOf(iframe);
                            selector = `iframe:nth-child(${index + 1})`;
                        } else {
                            selector = 'iframe';
                        }
                    }

                    // Only include this iframe in the path if it's not already represented
                    const currentPath = parentSelectors.length === 0 ? [selector] : [...parentSelectors, selector];
                    const fullPath = currentPath.join(' >> ');

                    // Get nested iframes only if they exist and are accessible
                    const nestedIframes = Array.from(doc.getElementsByTagName('iframe'));
                    const nestedContent = nestedIframes.length > 0 ? 
                        nestedIframes.flatMap(nestedIframe => {
                            try {
                                // Check if we can actually access the nested iframe
                                const nestedDoc = nestedIframe.contentDocument || nestedIframe.contentWindow?.document;
                                if (!nestedDoc) return [];
                                return getIframeContent(nestedIframe, currentPath);
                            } catch (e) {
                                console.log(`Could not access nested iframe: ${e}`);
                                return [];
                            }
                        }) : [];

                    // Add clear markers for input fields and their attributes
                    const content = doc.documentElement.outerHTML;
                    const inputFields = Array.from(doc.querySelectorAll('input')).map(input => ({
                        name: input.name,
                        id: input.id,
                        type: input.type,
                        value: input.value
                    }));

                    return [{
                        selector,
                        content: content + '\n<!-- Available Input Fields: ' + JSON.stringify(inputFields, null, 2) + ' -->',
                        fullPath
                    }, ...nestedContent];
                } catch (e) {
                    console.log(`Could not access iframe content: ${e}`);
                    return [];
                }
            };

            // Get content from all root iframes
            const rootIframes = Array.from(document.getElementsByTagName('iframe'));
            return rootIframes.flatMap(iframe => getIframeContent(iframe));
        });

        // Combine main document and iframe content in the snapshot with clear structure markers
        taskMessage.snapshot = {
            ...mainSnapshot,
            dom: mainSnapshot.dom + '\n\n' + iframeContent.map(frame => 
                `--- Content of ${frame.fullPath} ---\n` +
                `<!-- Frame Structure: ${frame.fullPath} -->\n` +
                frame.content +
                `\n--- End of ${frame.fullPath} ---`
            ).join('\n\n')
        };
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

    // Create a modified prompt that handles iframe content
    const selectorPrompt = `Analyze the given task and webpage DOM to identify the exact element described in the task.

IMPORTANT GUIDELINES:
- Look for elements that semantically match what the task is requesting
- Pay careful attention to the exact element type being requested in the task
- Compare element attributes (name, id, type, etc.) with the task description
- Ensure the selected element is the best match for the task's intent

Task: ${typeof taskMessage.task === 'string' ? taskMessage.task : taskMessage.task.join('\n')}

DOM Structure:

\`\`\`
${taskMessage.snapshot.dom}
\`\`\`

Return a single line with only the CSS selector. For elements in iframes, use "parent >> child" syntax.`;
    
    // Send the prompt to Gemini
    const result = await model.generateContent(selectorPrompt);
    const text = result.response.text();
    
    if (debug) {
        console.log("> Response", text);
    }
    
    // Clean up the response to get just the CSS selector
    let cssSelector = text
        .replace(/```css/g, "")
        .replace(/```/g, "")
        .replace(/`/g, "")
        .replace(/^.*selector:.*$/mi, "")
        .trim();
    
    // If the response contains multiple lines, try to extract just the selector
    if (cssSelector.includes("\n")) {
        const lines = cssSelector.split("\n").map(line => line.trim());
        const selectorLine = lines.find(line => 
            (line.match(/[#\.\[\]='"~>+]/) || line.includes(">>")) && 
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

    // Handle error messages from the AI
    if (cssSelector.toLowerCase().includes("no") && 
        cssSelector.toLowerCase().includes("field") && 
        cssSelector.toLowerCase().includes("visible")) {
        if (debug) {
            console.log("> AI could not find the element. Full response:", text);
        }
        throw new Error("Element not found in the provided DOM snapshot. Please check if the element exists or if it's in a not-yet-loaded iframe.");
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