import type { Plugin } from '@elizaos/core';
import {
  logger,
} from '@elizaos/core';
import { z } from 'zod';
import SandboxService from 'src/sandbox-service';
import executeCodeAction from 'src/actions/execute-code-action';
import closeSandboxAction from 'src/actions/close-sandbox-action';

/**
 * Defines the configuration schema for the E2B plugin.
 */
const configSchema = z.object({
  E2B_API_KEY: z
    .string()
    .min(1, 'E2B API key is required')
    .default(process.env.E2B_API_KEY || ''),
});



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
  actions: [executeCodeAction, closeSandboxAction],
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