import type { Action } from "@elizaos/core";
import { createCodeExecutionAction } from "./create-code-execution-action";

const executeRlangAction: Action = createCodeExecutionAction({
    name: 'EXECUTE_R_CODE',
    language: 'r',
    similes: ['RUN_R', 'EXECUTE_R', 'RUN_RSCRIPT', 'EXECUTE_RSCRIPT'],
    description: 'Executes R code in a secure sandboxed environment',
    examples: [
        [
            {
                user: '{{name1}}',
                content: {
                    text: 'print("Hello, world!")',
                },
            },
            {
                user: '{{name2}}',
                content: {
                    text: 'Hello, world!',
                    stdout: 'Hello, world!',
                    actions: ['EXECUTE_R_CODE'],
                },
            },
        ],
    ],
})

export default executeRlangAction;
