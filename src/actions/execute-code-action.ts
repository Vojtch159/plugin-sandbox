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
import SandboxService from 'src/sandbox-service';
import { CodeResponse } from 'src/types';
import { parseCodeResposnse } from 'src/utils';

const executeCodeAction: Action = {
    name: 'EXECUTE_PYTHON_CODE',
    similes: ['RUN_PYTHON', 'EXECUTE_CODE', 'RUN_CODE'],
    description: 'Executes Python code in a secure sandboxed environment',

    validate: async (runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
        // Validate that the message contains Python code
        const code = message.content?.code || message.content?.text;
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
            logger.info('Handling EXECUTE_PYTHON_CODE action');
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
            logger.info(`Executing Python code for user ${sourceId}`);
            logger.debug(`Code: ${code}`);

            const execution = await sandbox.runCode(code, {
                language: 'python',
            });
            logger.info(`Execution result: ${execution}`);

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
            return handleError(`Error in EXECUTE_PYTHON_CODE action: ${error}`, message, callback);
        }
    },

    examples: [
        [
            {
                user: '{{name1}}',
                content: {
                    text: 'import numpy as np\nprint(np.random.rand(5))',
                },
            },
            {
                user: '{{name2}}',
                content: {
                    text: '[0.42, 0.71, 0.29, 0.35, 0.63]',
                    stdout: '[0.42, 0.71, 0.29, 0.35, 0.63]',
                    actions: ['EXECUTE_PYTHON_CODE'],
                },
            },
        ],
    ],
};

// Helper functions to improve readability and maintainability

function extractCode(message: Memory): string | null {
    return message.content?.code || message.content?.text || null;
}

function extractSourceId(message: Memory): string {
    return typeof message.content?.source === 'object' && message.content?.source
        ? (message.content.source as { id?: string }).id || 'default-user'
        : 'default-user';
}

async function getSandboxForUser(sourceId: string) {
    try {
        return await SandboxService.getSandbox(sourceId);
    } catch (error) {
        logger.error(`Error getting sandbox for user ${sourceId}:`, error);
        return null;
    }
}

function processExecutionResults(
    code: string,
    stdout: string,
    stderr: string,
    execution: any,
    source: any
): Content {
    if (stderr) {
        logger.error(`Error executing Python code: ${stderr}`);
        return {
            text: stderr,
            actions: ['EXECUTE_PYTHON_CODE'],
            source: source,
        };
    }

    // Format successful execution response
    let text = "Successfully executed Python code: \n";
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
        actions: ['EXECUTE_PYTHON_CODE'],
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
        text: `Error executing Python code: \n${error.value}\n\n${error.traceback}`,
        actions: ['EXECUTE_PYTHON_CODE'],
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
        text: `Error executing Python code: \n${errorMessage}`,
        actions: ['EXECUTE_PYTHON_CODE'],
        source: message.content?.source,
    };

    await callback(errorContent);
    return errorContent;
}

export default executeCodeAction;