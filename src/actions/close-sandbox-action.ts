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

const closeSandboxAction: Action = {
    name: 'CLOSE_SANDBOX',
    similes: ['TERMINATE_SANDBOX', 'STOP_SANDBOX'],
    description: 'Closes the sandbox for a specific user',

    validate: async (_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<boolean> => {
        // Always valid
        return true;
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state: State,
        _options: any,
        callback: HandlerCallback,
        _responses: Memory[]
    ) => {
        try {
            logger.info('Handling CLOSE_SANDBOX action');

            // Extract a user identifier from the source
            // Safely handle the source which might be a complex object or a string
            const sourceId = typeof message.content?.source === 'object' && message.content?.source
                ? (message.content.source as { id?: string }).id || 'default-user'
                : 'default-user';

            // Get the sandbox service
            const sandboxService = runtime.getService('e2b-sandbox') as SandboxService;
            if (!sandboxService) {
                throw new Error('E2B Sandbox service not found');
            }

            // Close the sandbox for this user
            await sandboxService.closeSandbox(sourceId);

            // Prepare the response content
            const responseContent: Content = {
                text: `Sandbox closed for user ${sourceId}`,
                actions: ['CLOSE_SANDBOX'],
                source: message.content.source,
            };

            // Call back with the result
            await callback(responseContent);

            return responseContent;
        } catch (error) {
            logger.error('Error in CLOSE_SANDBOX action:', error);

            // Create an error response
            const errorContent: Content = {
                text: `Error closing sandbox: ${error}`,
                actions: ['CLOSE_SANDBOX'],
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
                    text: 'Close my sandbox',
                },
            },
            {
                name: '{{name2}}',
                content: {
                    text: 'Sandbox closed for user default-user',
                    actions: ['CLOSE_SANDBOX'],
                },
            },
        ],
    ],
};

export default closeSandboxAction;