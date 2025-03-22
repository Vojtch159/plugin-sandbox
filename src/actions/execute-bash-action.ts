import { Action } from "@elizaos/core";
import { createCodeExecutionAction } from "./create-code-execution-action";

const executeBashAction: Action = createCodeExecutionAction({
    name: 'EXECUTE_BASH_CODE',
    language: 'bash',
    similes: ['RUN_BASH', 'EXECUTE_BASH', 'RUN_SHELL', 'EXECUTE_SHELL'],
    description: 'Executes Bash code in a secure sandboxed environment',
    examples: [
        [
            {
                user: '{{name1}}',
                content: {
                    text: 'echo "Hello, world!"',
                },
            },
            {
                user: '{{name2}}',
                content: {
                    text: 'Hello, world!',
                    stdout: 'Hello, world!',
                    actions: ['EXECUTE_BASH_CODE'],
                },
            },
        ],
        [
            {
                user: '{{name1}}',
                content: {
                    text: 'cat /etc/passwd',
                },
            },
            {
                user: '{{name2}}',
                content: {
                    text: 'Contents of /etc/passwd file:\nroot:x:0:0:root:/root:/bin/bash\n[...other user accounts...]',
                    stdout: 'root:x:0:0:root:/root:/bin/bash\n[...other user accounts...]',
                    actions: ['EXECUTE_BASH_CODE'],
                },
            },
        ],
    ]
})

export default executeBashAction;
