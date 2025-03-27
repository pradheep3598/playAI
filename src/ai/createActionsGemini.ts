import { Locator, Page } from "@playwright/test";
import { randomUUID } from "crypto";
import { z } from "zod";

// Define a Gemini-compatible function type that mimics OpenAI's function structure
type GeminiFunctionDefinition = {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
    };
};

type GeminiFunction = {
    function: (...args: any[]) => Promise<any> | any;
    definition: GeminiFunctionDefinition;
    parse: (args: string) => any;
};

/**
 * Creates a set of actions that can be performed on a Playwright `page`.
 *
 * This function generates a record of actions that can be executed on a Playwright `page`. Each action is formatted
 * to be compatible with Google's Gemini API function calling interface.
 *
 * @param {Page} page - The Playwright `page` object where the actions will be performed.
 * @returns {Record<string, GeminiFunction>} - A record of actions that can be performed on the page.
 */
export const createActionsGemini = (
    page: Page
): Record<string, GeminiFunction> => {
    const locatorMap = new Map();

    /**
     * Retrieves a locator from the locator map using the provided element ID.
     *
     * @param {string} elementId - The ID of the element to locate.
     * @returns {Locator} - The Playwright `Locator` object for the specified element.
     * @throws {Error} - Throws an error if the element ID is not found in the locator map.
     */
    const getLocator = (elementId: string): Locator => {
        console.log("locatorMap", locatorMap);
        const locator: Locator = locatorMap.get(elementId);

        if (!locator) {
            throw new Error('Unknown elementId "' + elementId + '"');
        }

        return locator;
    };

    /**
     * Scrolls the page to bring the specified element into view.
     *
     * @param {Locator} locator - The Playwright `Locator` object for the element to scroll into view.
     * @returns {Promise<void>}
     */
    const scrollIntoView = async (locator: Locator) => {
        let i = 0;
        while (await locator.isHidden()) {
            await page.mouse.wheel(0, 300);
            i++;
            if (await locator.isVisible()) {
                return;
            } else if (i >= 5) {
                return;
            }
        }
    };

    /**
     * Waits for the page to load completely.
     *
     * @returns {Promise<void>}
     */
    const waitForPageLoad = async () => {
        await page.waitForLoadState("domcontentloaded", { timeout: 30000 });
    };

    return {
        locateElement: {
            function: async (args: { cssSelector: string }) => {
                const locator: Locator = await page.locator(args.cssSelector);
                const elementId = randomUUID();
                locatorMap.set(elementId, locator);
                return {
                    elementId
                };
            },
            definition: {
                name: "locateElement",
                description:
                    "Locates element using a CSS selector and returns elementId. This element ID can be used with other functions to perform actions on the element.",
                parameters: {
                    type: "object",
                    properties: {
                        cssSelector: {
                            type: "string"
                        }
                    },
                    required: ["cssSelector"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        cssSelector: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_evaluate: {
            function: async (args: {
                pageFunction: string;
                elementId: string;
            }) => {
                return {
                    result: await getLocator(args.elementId).evaluate(
                        args.pageFunction
                    )
                };
            },
            definition: {
                name: "locator_evaluate",
                description:
                    "Execute JavaScript code in the page, taking the matching element as an argument.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        },
                        pageFunction: {
                            type: "string",
                            description:
                                "Function to be evaluated in the page context, e.g. node => node.innerText"
                        }
                    },
                    required: ["elementId", "pageFunction"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string(),
                        pageFunction: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_getAttribute: {
            function: async (args: {
                attributeName: string;
                elementId: string;
            }) => {
                return {
                    attributeValue: await getLocator(
                        args.elementId
                    ).getAttribute(args.attributeName)
                };
            },
            definition: {
                name: "locator_getAttribute",
                description: "Returns the matching element's attribute value.",
                parameters: {
                    type: "object",
                    properties: {
                        attributeName: {
                            type: "string"
                        },
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["attributeName", "elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string(),
                        attributeName: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_innerHTML: {
            function: async (args: { elementId: string }) => {
                return {
                    innerHTML: await getLocator(args.elementId).innerHTML()
                };
            },
            definition: {
                name: "locator_innerHTML",
                description: "Returns the element.innerHTML.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_innerText: {
            function: async (args: { elementId: string }) => {
                return {
                    innerText: await getLocator(args.elementId).innerText()
                };
            },
            definition: {
                name: "locator_innerText",
                description: "Returns the element.innerText.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_textContent: {
            function: async (args: { elementId: string }) => {
                return {
                    textContent: await getLocator(args.elementId).textContent()
                };
            },
            definition: {
                name: "locator_textContent",
                description: "Returns the node.textContent.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_inputValue: {
            function: async (args: { elementId: string }) => {
                return {
                    inputValue: await getLocator(args.elementId).inputValue()
                };
            },
            definition: {
                name: "locator_inputValue",
                description:
                    "Returns input.value for the selected <input> or <textarea> or <select> element.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_blur: {
            function: async (args: { elementId: string }) => {
                await getLocator(args.elementId).blur();
                return { success: true };
            },
            definition: {
                name: "locator_blur",
                description: "Removes keyboard focus from the current element.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_boundingBox: {
            function: async (args: { elementId: string }) => {
                return await getLocator(args.elementId).boundingBox();
            },
            definition: {
                name: "locator_boundingBox",
                description:
                    "This method returns the bounding box of the element matching the locator, or null if the element is not visible. The bounding box is calculated relative to the main frame viewport - which is usually the same as the browser window. The returned object has x, y, width, and height properties.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_check: {
            function: async (args: { elementId: string }) => {
                await getLocator(args.elementId).check();
                return { success: true };
            },
            definition: {
                name: "locator_check",
                description: "Ensure that checkbox or radio element is checked.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_uncheck: {
            function: async (args: { elementId: string }) => {
                await getLocator(args.elementId).uncheck();
                return { success: true };
            },
            definition: {
                name: "locator_uncheck",
                description: "Ensure that checkbox or radio element is unchecked.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_isChecked: {
            function: async (args: { elementId: string }) => {
                return {
                    isChecked: await getLocator(args.elementId).isChecked()
                };
            },
            definition: {
                name: "locator_isChecked",
                description: "Returns whether the element is checked.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_isEditable: {
            function: async (args: { elementId: string }) => {
                return {
                    isEditable: await getLocator(args.elementId).isEditable()
                };
            },
            definition: {
                name: "locator_isEditable",
                description:
                    "Returns whether the element is editable. Element is considered editable when it is enabled and does not have readonly property set.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_isEnabled: {
            function: async (args: { elementId: string }) => {
                return {
                    isEnabled: await getLocator(args.elementId).isEnabled()
                };
            },
            definition: {
                name: "locator_isEnabled",
                description:
                    "Returns whether the element is enabled. Element is considered enabled unless it is a <button>, <select>, <input> or <textarea> with a disabled property.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_isVisible: {
            function: async (args: { elementId: string }) => {
                return {
                    isVisible: await getLocator(args.elementId).isVisible()
                };
            },
            definition: {
                name: "locator_isVisible",
                description: "Returns whether the element is visible.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_clear: {
            function: async (args: { elementId: string }) => {
                await getLocator(args.elementId).clear();
                return { success: true };
            },
            definition: {
                name: "locator_clear",
                description: "Clear the input field.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_click: {
            function: async (args: { elementId: string }) => {
                await getLocator(args.elementId).click();
                return { success: true };
            },
            definition: {
                name: "locator_click",
                description: "Click an element.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_dbl_click: {
            function: async (args: { elementId: string }) => {
                await getLocator(args.elementId).dblclick();
                return { success: true };
            },
            definition: {
                name: "locator_dbl_click",
                description: "Double Click an element.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_count: {
            function: async (args: { elementId: string }) => {
                return {
                    elementCount: await getLocator(args.elementId).count()
                };
            },
            definition: {
                name: "locator_count",
                description: "Returns the number of elements matching the locator.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_fill: {
            function: async (args: { value: string; elementId: string }) => {
                await getLocator(args.elementId).fill(args.value);
                return {
                    success: true
                };
            },
            definition: {
                name: "locator_fill",
                description: "Set a value to the input field.",
                parameters: {
                    type: "object",
                    properties: {
                        value: {
                            type: "string"
                        },
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["value", "elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string(),
                        value: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_hover: {
            function: async (args: { elementId: string }) => {
                await getLocator(args.elementId).hover();
                return {
                    success: true
                };
            },
            definition: {
                name: "locator_hover",
                description: "Hover on an element.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_scroll_into_view_if_needed: {
            function: async (args: { elementId: string }) => {
                await getLocator(args.elementId).scrollIntoViewIfNeeded();
                return { success: true };
            },
            definition: {
                name: "locator_scroll_into_view_if_needed",
                description: "Scroll into view an element if needed.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_scroll_into_element_view: {
            function: async (args: { elementId: string }) => {
                await scrollIntoView(getLocator(args.elementId));
                return { success: true };
            },
            definition: {
                name: "locator_scroll_into_element_view",
                description: "Scroll into view an element.",
                parameters: {
                    type: "object",
                    properties: {
                        elementId: {
                            type: "string"
                        }
                    },
                    required: ["elementId"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        elementId: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        locator_wait_for_page_load: {
            function: async () => {
                await waitForPageLoad();
                return { success: true };
            },
            definition: {
                name: "locator_wait_for_page_load",
                description: "Wait until page load completely",
                parameters: {
                    type: "object",
                    properties: {}
                }
            },
            parse: (args: string) => {
                return z.object({}).parse(JSON.parse(args));
            }
        },
        page_goto: {
            function: async (args: { url: string }) => {
                return {
                    url: await page.goto(args.url)
                };
            },
            definition: {
                name: "page_goto",
                description: "Navigate to a URL",
                parameters: {
                    type: "object",
                    properties: {
                        url: {
                            type: "string"
                        }
                    },
                    required: ["url"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        url: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        expect_toBe: {
            function: (args: { actual: string; expected: string }) => {
                return {
                    actual: args.actual,
                    expected: args.expected,
                    success: args.actual === args.expected
                };
            },
            definition: {
                name: "expect_toBe",
                description:
                    "Asserts that the actual value is equal to the expected value.",
                parameters: {
                    type: "object",
                    properties: {
                        actual: {
                            type: "string"
                        },
                        expected: {
                            type: "string"
                        }
                    },
                    required: ["actual", "expected"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        actual: z.string(),
                        expected: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        expect_notToBe: {
            function: (args: { actual: string; expected: string }) => {
                return {
                    actual: args.actual,
                    expected: args.expected,
                    success: args.actual !== args.expected
                };
            },
            definition: {
                name: "expect_notToBe",
                description:
                    "Asserts that the actual value is not equal to the expected value.",
                parameters: {
                    type: "object",
                    properties: {
                        actual: {
                            type: "string"
                        },
                        expected: {
                            type: "string"
                        }
                    },
                    required: ["actual", "expected"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        actual: z.string(),
                        expected: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        resultAssertion: {
            function: (args: { assertion: boolean }) => {
                return args;
            },
            definition: {
                name: "resultAssertion",
                description:
                    "This function is called when the initial instructions asked to assert something; then 'assertion' is either true or false (boolean) depending on whether the assertion succeeded.",
                parameters: {
                    type: "object",
                    properties: {
                        assertion: {
                            type: "boolean"
                        }
                    },
                    required: ["assertion"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        assertion: z.boolean()
                    })
                    .parse(JSON.parse(args));
            }
        },
        resultQuery: {
            function: (args: { query: string }) => {
                return args;
            },
            definition: {
                name: "resultQuery",
                description:
                    "This function is called at the end when the initial instructions asked to extract data; then 'query' property is set to a text value of the extracted data.",
                parameters: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string"
                        }
                    },
                    required: ["query"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        query: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        },
        resultAction: {
            function: () => {
                return null;
            },
            definition: {
                name: "resultAction",
                description:
                    "This function is called at the end when the initial instructions asked to perform an action.",
                parameters: {
                    type: "object",
                    properties: {}
                }
            },
            parse: (args: string) => {
                return z.object({}).parse(JSON.parse(args));
            }
        },
        resultError: {
            function: (args: { errorMessage: string }) => {
                return {
                    errorMessage: args.errorMessage
                };
            },
            definition: {
                name: "resultError",
                description:
                    "If user instructions cannot be completed, then this function is used to produce the final response.",
                parameters: {
                    type: "object",
                    properties: {
                        errorMessage: {
                            type: "string"
                        }
                    },
                    required: ["errorMessage"]
                }
            },
            parse: (args: string) => {
                return z
                    .object({
                        errorMessage: z.string()
                    })
                    .parse(JSON.parse(args));
            }
        }
    };
}; 