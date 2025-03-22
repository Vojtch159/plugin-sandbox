import {
    type Action,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    ServiceType,
    type State,
    elizaLogger as logger,
} from '@elizaos/core';
import SandboxService from 'src/sandbox-service';

const closeSandboxAction: Action = {
    name: 'LIST_SANDBOXES',
    similes: ['LIST_SANDBOXES', 'LIST_SANDBOX', 'LIST_SANDBOXES_FOR_USER'],
    description: 'Lists all sandboxes for a specific user',

    validate: async (_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<boolean> => {
        // Always valid
        return true;
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback,
    ) => {
        try {
            logger.info('Handling LIST_SANDBOXES action');

            // Extract a user identifier from the source
            // Safely handle the source which might be a complex object or a string
            const sourceId = typeof message.content?.source === 'object' && message.content?.source
                ? (message.content.source as { id?: string }).id || 'default-user'
                : 'default-user';

            // Get the sandbox service
            const sandboxService = runtime.getService('e2b-sandbox' as ServiceType) as SandboxService;
            if (!sandboxService) {
                throw new Error('E2B Sandbox service not found');
            }

            // Close the sandbox for this user
            const sandboxes = await SandboxService.list();

            // Format sandboxes in a readable way
            const formattedSandboxes = sandboxes.length > 0
                ? sandboxes.map(sandbox =>
                    `\n- ID: ${sandbox.sandboxId}
  Template: ${sandbox.templateId}
  Name: ${sandbox.name}
  Started: ${new Date(sandbox.startedAt).toLocaleString()}`
                ).join('')
                : ' No sandboxes found.';

            // Prepare the response content
            const responseContent: Content = {
                text: `Sandboxes for user ${sourceId}:${formattedSandboxes}`,
                actions: ['LIST_SANDBOXES'],
                source: message.content.source,
            };

            // Call back with the result
            await callback(responseContent);

            return responseContent;
        } catch (error) {
            logger.error('Error in LIST_SANDBOXES action:', error);

            // Create an error response
            const errorContent: Content = {
                text: `Error listing sandboxes: ${error}`,
                actions: ['LIST_SANDBOXES'],
                source: message.content.source,
            };

            await callback(errorContent);
            return errorContent;
        }
    },

    examples: [
        [
            {
                user: '{{name1}}',
                content: {
                    text: 'List my sandboxes',
                },
            },
            {
                user: '{{name2}}',
                content: {
                    text: 'Sandboxes for user default-user',
                    actions: ['LIST_SANDBOXES'],
                },
            },
        ],
    ],
};

export default closeSandboxAction;