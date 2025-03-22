import {
    type Action,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    logger,
} from '@elizaos/core';
import SandboxService from 'src/sandbox-service';
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
        _options: any,
        callback: HandlerCallback,
        _responses: Memory[]
    ) => {
        try {
            logger.info('Handling EXECUTE_PYTHON_CODE action');

            logger.info(`Message: ${JSON.stringify(message)}`);

            // Get the code to execute
            const code = message.content?.code || message.content?.text;
            if (!code) {
                throw new Error('No code provided');
            }

            // Extract a user identifier from the source
            // Safely handle the source which might be a complex object or a string
            const sourceId = typeof message.content?.source === 'object' && message.content?.source
                ? (message.content.source as { id?: string }).id || 'default-user'
                : 'default-user';

            // Get the sandbox service
            const sandboxService = runtime.getService('e2b-sandbox');
            if (!sandboxService) {
                throw new Error('E2B Sandbox service not found');
            }

            // Get or create a sandbox for this user
            // Get or create a sandbox for this user
            let sandbox;
            try {
                sandbox = await SandboxService.getSandbox(sourceId);
            } catch (error) {
                logger.error(`Error getting sandbox for user ${sourceId}:`, error);
                throw new Error(`Failed to initialize sandbox: ${error.message}`);
            }

            // Execute the code
            logger.info(`Executing Python code for user ${sourceId}`);
            logger.info(`Code: ${code}`);
            const execution = await sandbox.runCode(code as string);
            logger.info(`Execution result: ${JSON.stringify(execution)}`);
            const { stdout, stderr, results } = parseCodeResposnse(execution);

            let responseContent: Content | undefined;

            if (stderr) {
                logger.error(`Error executing Python code: ${stderr}`);
                responseContent = {
                    text: stderr,
                    actions: ['EXECUTE_PYTHON_CODE'],
                    source: message.content.source,
                };
            } else {
                let text = "Successfully executed Python code: \n";

                text += code;
                text += "\n\n";

                text += "Output: \n";

                for (const result of stdout) {
                    text += `${result}`;
                }

                // Prepare the response content
                responseContent = {
                    text: text || '',
                    stdout: execution.logs?.stdout?.join('\n') || '',
                    stderr: execution.logs?.stderr?.join('\n') || '',
                    actions: ['EXECUTE_PYTHON_CODE'],
                    source: message.content.source,
                };
            }


            // Call back with the execution result
            await callback(responseContent);

            return responseContent;
        } catch (error) {
            logger.error('Error in EXECUTE_PYTHON_CODE action:', error);

            // Create an error response
            const errorContent: Content = {
                text: `Error executing Python code: ${error}`,
                actions: ['EXECUTE_PYTHON_CODE'],
                source: message.content.source,
            };

            await callback(errorContent);
            return errorContent;
        }
    },

    examples: [
        [
            {
                name: '{{name1}}',
                content: {
                    text: 'import numpy as np\nprint(np.random.rand(5))',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: '[0.42, 0.71, 0.29, 0.35, 0.63]',
                    stdout: '[0.42, 0.71, 0.29, 0.35, 0.63]',
                    actions: ['EXECUTE_PYTHON_CODE'],
                },
            },
        ],
    ],
};

export default executeCodeAction;