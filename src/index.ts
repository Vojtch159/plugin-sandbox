import type { Plugin } from '@elizaos/core';
import SandboxService from './sandbox-service';
import executeCodeAction from './actions/execute-code-action';
import executeJavaScriptAction from './actions/execute-javascript-action';
import listSandboxesAction from './actions/list-sandboxes-action';
import executeBashAction from './actions/execute-bash-action';
import executeJavaAction from './actions/execute-java-action';
import executeRlangAction from './actions/execute-rlang-action';
import { fileReadAction, fileWriteAction } from './actions/file-operations-action';

export const e2bSandboxPlugin: Plugin = {
  name: 'plugin-e2b-sandbox',
  description: 'Plugin for running Python code in a secure E2B sandbox environment',
  config: {
    E2B_API_KEY: process.env.E2B_API_KEY,
  },
  services: [SandboxService],
  actions: [
    executeCodeAction,
    executeJavaScriptAction,
    executeBashAction,
    executeJavaAction,
    executeRlangAction,
    listSandboxesAction,
    fileReadAction,
    fileWriteAction,
  ],
};

export default e2bSandboxPlugin;
