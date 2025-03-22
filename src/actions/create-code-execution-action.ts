import { ExecutionError } from '@e2b/code-interpreter';
import {
    type Action,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    ServiceType,
    elizaLogger as logger,
} from '@elizaos/core';
import SandboxService from '../sandbox-service';
import { extractSourceId, parseCodeResposnse } from '../utils';

// Type for language configuration
interface LanguageConfig {
    name: string;                 // Action name
    language: string;             // Language identifier for e2b
    similes: string[];            // Alternative action names
    description: string;          // Action description
    examples: Array<Array<any>>;  // Examples for the action
}

// Helper functions shared across all code execution actions
function extractCode(message: Memory): string | null {
    const code = parseCodeBlock(message.content?.text || '');
    return code;
}

async function getSandboxForUser(sourceId: string) {
    try {
        return await SandboxService.getSandbox(sourceId);
    } catch (error) {
        logger.error(`Error getting sandbox for user ${sourceId}:`, error);
        return null;
    }
}

function parseCodeBlock(text: string): string {
    if (!text) return '';

    // Look for code blocks delimited by triple backticks
    const codeBlockRegex = /```(?:([a-zA-Z0-9]+)[\r\n]+)?([\s\S]+?)```/;
    const match = text.match(codeBlockRegex);

    logger.info(`MATCH: ${JSON.stringify(match)}`);
    console.log(`MATCH: ${JSON.stringify(match)}`);

    if (match) {
        // match[1] would be the language (optional)
        // match[2] is the code content
        return match[2].trim();
    }

    return text;
}

// Factory function to create language-specific code execution actions
export function createCodeExecutionAction(config: LanguageConfig): Action {
    const actionName = config.name;

    // Create handler functions with the specific language context
    function processExecutionResults(
        code: string,
        stdout: string,
        stderr: string,
        execution: any,
        source: any
    ): Content {
        if (stderr) {
            logger.error(`Error executing ${config.language} code: ${stderr}`);
            return {
                text: stderr,
                actions: [actionName],
                source: source,
            };
        }

        // Format successful execution response
        let text = `Successfully executed ${config.language} code: \n`;
        text += code;
        text += "\n\n";
        text += "Output: \n";

        for (const result of stdout) {
            text += `${result}`;
        }

        return {
            text: text,
            stdout: execution.logs?.stdout?.join('\n') || '',
            stderr: execution.logs?.stderr?.join('\n') || '',
            actions: [actionName],
            source: source,
        };
    }

    async function handleException(
        error: ExecutionError,
        message: Memory,
        callback: HandlerCallback
    ) {
        logger.error(error);

        const errorContent: Content = {
            text: `Error executing ${config.language} code: \n${error.value}\n\n${error.traceback}`,
            actions: [actionName],
            source: message.content?.source,
        };

        await callback(errorContent);
        return errorContent;
    }

    async function handleError(
        errorMessage: string,
        message: Memory,
        callback: HandlerCallback
    ): Promise<Content> {
        logger.error(errorMessage);

        const errorContent: Content = {
            text: `Error executing ${config.language} code: \n${errorMessage}`,
            actions: [actionName],
            source: message.content?.source,
        };

        await callback(errorContent);
        return errorContent;
    }

    // Return the configured action
    return {
        name: actionName,
        similes: config.similes,
        description: config.description,

        validate: async (runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
            // Validate that the message contains code
            const code = parseCodeBlock(message.content?.text || '');
            return !!code && typeof code === 'string';
        },

        handler: async (
            runtime: IAgentRuntime,
            message: Memory,
            state: State,
            options: any,
            callback: HandlerCallback,
        ) => {
            try {
                logger.info(`Handling ${actionName} action`);
                logger.debug(`Message: ${JSON.stringify(message)}`);

                // Extract code and validate
                const code = extractCode(message);
                if (!code) {
                    return handleError('No code provided', message, callback);
                }

                // Extract user identifier
                const sourceId = extractSourceId(message);

                // Get the sandbox service
                const sandboxService = runtime.getService('e2b-sandbox' as ServiceType) as SandboxService;
                if (!sandboxService) {
                    return handleError('E2B Sandbox service not found', message, callback);
                }

                // Get or create a sandbox for this user
                const sandbox = await getSandboxForUser(sourceId);
                if (!sandbox) {
                    return handleError('Failed to initialize sandbox', message, callback);
                }

                // Execute the code
                logger.info(`Executing ${config.language} code for user ${sourceId}`);
                logger.debug(`Code: ${code}`);

                const execution = await sandbox.runCode(code, {
                    language: config.language.toLowerCase(),
                });
                logger.info(`Execution result: ${JSON.stringify(execution)}`);

                logger.info(`Execution result type: ${typeof execution}`);
                logger.info(`Execution result type: ${execution.error}`);
                logger.info(`Execution result logs: ${execution.logs}`);
                logger.info(`Execution result results: ${execution.results}`);
                logger.info(`Execution result error: ${execution.error}`);
                logger.info(`Execution result stdout: ${execution.logs.stdout}`);
                logger.info(`Execution result stderr: ${execution.logs.stderr}`);

                const { stdout, stderr, error } = parseCodeResposnse(execution);

                if (error) {
                    return handleException(error, message, callback);
                }

                // Process execution results
                const responseContent = processExecutionResults(
                    code,
                    stdout,
                    stderr,
                    execution,
                    message.content.source
                );

                // Call back with the execution result
                await callback(responseContent);
                return responseContent;
            } catch (error) {
                return handleError(`Error in ${actionName} action: ${error}`, message, callback);
            }
        },

        examples: config.examples,
    };
}
