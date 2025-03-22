import type { Plugin } from '@elizaos/core';
import SandboxService from './sandbox-service';
import executeCodeAction from './actions/execute-code-action';
import listSandboxesAction from 'src/actions/list-sandboxes.action';
export const e2bSandboxPlugin: Plugin = {
  name: 'plugin-e2b-sandbox',
  description: 'Plugin for running Python code in a secure E2B sandbox environment',
  config: {
    E2B_API_KEY: process.env.E2B_API_KEY,
  },
  services: [SandboxService],
  actions: [executeCodeAction, listSandboxesAction],
};

export default e2bSandboxPlugin;