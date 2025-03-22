import type { Plugin } from '@elizaos/core';
import {
  type Action,
  type Content,
  type GenerateTextParams,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type Provider,
  type ProviderResult,
  Service,
  type State,
  logger,
} from '@elizaos/core';
import { z } from 'zod';
import { Sandbox } from '@e2b/code-interpreter';

/**
 * Defines the configuration schema for the E2B plugin.
 */
const configSchema = z.object({
  E2B_API_KEY: z
    .string()
    .min(1, 'E2B API key is required')
    .default(process.env.E2B_API_KEY || ''),
});

/**
 * Service to manage the E2B sandbox lifecycle
 */
export class SandboxService extends Service {
  static serviceType = 'e2b-sandbox';
  capabilityDescription = 'This service provides a secure sandboxed environment for executing Python code.';
  sandboxes: Map<string, Sandbox> = new Map();

  constructor(protected runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime) {
    logger.info(`*** Starting E2B Sandbox service: ${new Date().toISOString()} ***`);
    const service = new SandboxService(runtime);

    const sandbox = await Sandbox.create({
      metadata: {
        userId: 'default-user',
        createdAt: new Date().toISOString(),
        purpose: 'python-code-execution',
        sessionId: `session-${Date.now()}`
      }
    })

    const runningSandboxes = await Sandbox.list() 
    const runningSandbox = runningSandboxes[0]

    console.log('Running sandbox metadata:', runningSandbox.metadata)
    console.log('Running sandbox id:', runningSandbox.sandboxId)
    console.log('Running sandbox started at:', runningSandbox.startedAt)
    console.log('Running sandbox template id:', runningSandbox.templateId)
    

    logger.info(`E2B Sandbox service started`);
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info('*** Stopping E2B Sandbox service ***');
    const service = runtime.getService(SandboxService.serviceType);
    if (!service) {
      throw new Error('E2B Sandbox service not found');
    }
    await service.stop();
  }

  async stop() {
    logger.info('*** Closing all E2B sandboxes ***');
    // Close all active sandboxes
    const closingPromises = [];
    for (const [id, sandbox] of this.sandboxes.entries()) {
      logger.info(`Closing sandbox: ${id}`);
      closingPromises.push(sandbox.kill());
      this.sandboxes.delete(id);
    }
    await Promise.all(closingPromises);
  }

  async getSandbox(userId: string): Promise<Sandbox> {
    // Check if we already have a sandbox for this user
    if (this.sandboxes.has(userId)) {
      return this.sandboxes.get(userId)!;
    }

    // Create a new sandbox
    logger.info(`Creating new E2B sandbox for user: ${userId}`);
    try {
      const sandbox = await Sandbox.create({
        metadata: {
          userId: userId,
          createdAt: new Date().toISOString(),
          purpose: 'python-code-execution',
          sessionId: `session-${Date.now()}`
        }
      });

      const runningSandboxes = await Sandbox.list() 
      const runningSandbox = runningSandboxes[0]

      logger.info(`E2B sandbox created for user: ${userId}`);
      console.log('Running sandbox metadata:', runningSandbox.metadata)
      console.log('Running sandbox id:', runningSandbox.sandboxId)
      console.log('Running sandbox started at:', runningSandbox.startedAt)
      console.log('Running sandbox template id:', runningSandbox.templateId)

      this.sandboxes.set(userId, sandbox);
      return sandbox;
    } catch (error) {
      logger.error(`Error creating E2B sandbox: ${error}`);
      throw error;
    }
  }

  async closeSandbox(userId: string): Promise<void> {
    if (this.sandboxes.has(userId)) {
      const sandbox = this.sandboxes.get(userId)!;
      await sandbox.kill();
      this.sandboxes.delete(userId);
      logger.info(`Closed sandbox for user: ${userId}`);
    }
  }
}

/**
 * Action to execute Python code in the E2B sandbox
 */
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
      
      // Get the code to execute
      const code = message.content?.code || message.content?.text;
      if (!code) {
        throw new Error('No code provided');
      }

      // Extract a user identifier from the source
      // Safely handle the source which might be a complex object or a string
      const sourceId = typeof message.content?.source === 'object' && message.content?.source
        ? (message.content.source as any)?.id || 'default-user' 
        : 'default-user';
      
      // Get the sandbox service
      const sandboxService = runtime.getService('e2b-sandbox') as SandboxService;
      if (!sandboxService) {
        throw new Error('E2B Sandbox service not found');
      }

      // Get or create a sandbox for this user
      const sandbox = await sandboxService.getSandbox(sourceId);
      
      // Execute the code
      logger.info(`Executing Python code for user ${sourceId}`);
      const execution = await sandbox.runCode(code as string);
      logger.info(`Execution result: ${execution.text}`);
      
      // Prepare the response content
      const responseContent: Content = {
        text: execution.text || '',
        stdout: execution.logs?.stdout?.join('\n') || '',
        stderr: execution.logs?.stderr?.join('\n') || '',
        actions: ['EXECUTE_PYTHON_CODE'],
        source: message.content.source,
      };

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

/**
 * Provider to get all running sandboxes
 */
const sandboxesProvider: Provider = {
  name: 'SANDBOXES',
  description: 'Provides a list of all running sandboxes',
  dynamic: true,

  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State
  ): Promise<ProviderResult> => {
    try {
      logger.info('Handling SANDBOXES provider request');
      
      // Get all running sandboxes
      const runningSandboxes = await Sandbox.list();
      
      // Format the sandbox information
      const sandboxInfo = runningSandboxes.map(sandbox => ({
        sandboxId: sandbox.sandboxId,
        startedAt: sandbox.startedAt,
        templateId: sandbox.templateId,
        metadata: sandbox.metadata
      }));
      
      return {
        text: `Found ${runningSandboxes.length} running sandboxes`,
        values: {
          count: runningSandboxes.length,
          sandboxes: sandboxInfo
        }
      };
    } catch (error) {
      logger.error('Error in SANDBOXES provider:', error);
      return {
        text: `Failed to retrieve sandboxes: ${error}`
      };
    }
  }
};

/**
 * Action to list all running sandboxes
 */
const listSandboxesAction: Action = {
  name: 'LIST_SANDBOXES',
  similes: ['SHOW_SANDBOXES', 'GET_SANDBOXES'],
  description: 'Lists all running sandboxes',

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
      logger.info('Handling LIST_SANDBOXES action');
      
      // Use the sandboxes provider to get the data
      const result = await runtime.composeState(message, null, ['SANDBOXES']);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // Prepare the response content
      const responseContent: Content = {
        text: `Found ${result.data.count} running sandboxes`,
        sandboxes: result.data.sandboxes,
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
        name: '{{name1}}',
        content: {
          text: 'Show me all running sandboxes',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'Found 2 running sandboxes',
          sandboxes: [
            {
              sandboxId: 'sandbox-123',
              startedAt: '2023-06-01T12:00:00Z',
              templateId: 'template-abc',
              metadata: { userId: 'user-1', purpose: 'python-code-execution' }
            },
            {
              sandboxId: 'sandbox-456',
              startedAt: '2023-06-01T13:00:00Z',
              templateId: 'template-abc',
              metadata: { userId: 'user-2', purpose: 'python-code-execution' }
            }
          ],
          actions: ['LIST_SANDBOXES'],
        },
      },
    ],
  ],
};

/**
 * Action to close a specific sandbox
 */
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
        ? (message.content.source as any)?.id || 'default-user' 
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

export const e2bSandboxPlugin: Plugin = {
  name: 'plugin-e2b-sandbox',
  description: 'Plugin for running Python code in a secure E2B sandbox environment',
  config: {
    E2B_API_KEY: process.env.E2B_API_KEY,
  },
  async init(config: Record<string, string>) {
    logger.info('*** Initializing E2B Sandbox plugin ***');
    try {
      const validatedConfig = await configSchema.parseAsync(config);

      // Set all environment variables at once
      for (const [key, value] of Object.entries(validatedConfig)) {
        console.log(`Setting environment variable: ${key} = ${value}`);
        if (value) process.env[key] = value;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid plugin configuration: ${error.errors.map((e) => e.message).join(', ')}`
        );
      }
      throw error;
    }
  },
  services: [SandboxService],
  actions: [executeCodeAction, listSandboxesAction, closeSandboxAction],
  providers: [sandboxesProvider],
  tests: [
    {
      name: 'e2b_sandbox_test_suite',
      tests: [
        {
          name: 'should_have_execute_code_action',
          fn: async (runtime) => {
            // Check if the execute code action is registered
            const actionExists = e2bSandboxPlugin.actions.some((a) => a.name === 'EXECUTE_PYTHON_CODE');
            if (!actionExists) {
              throw new Error('Execute Python code action not found in plugin');
            }
          },
        },
        {
          name: 'should_have_sandbox_service',
          fn: async (runtime) => {
            // Start the plugin services
            await Promise.all(e2bSandboxPlugin.services.map(service => service.start(runtime)));
            
            // Check if the sandbox service is registered
            const service = runtime.getService('e2b-sandbox');
            if (!service) {
              throw new Error('E2B Sandbox service not found');
            }
            
            // Clean up
            await Promise.all(e2bSandboxPlugin.services.map(service => service.stop(runtime)));
          },
        },
      ],
    },
  ],
  events: {
    WORLD_JOINED: [
      async (params) => {
        logger.debug('WORLD_JOINED event received, ready to execute Python code');
      },
    ],
  },
};

export default e2bSandboxPlugin;
