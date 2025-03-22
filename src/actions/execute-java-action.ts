import type { Action } from "@elizaos/core";
import { createCodeExecutionAction } from "./create-code-execution-action";

const executeJavaAction: Action = createCodeExecutionAction({
    name: 'EXECUTE_JAVA_CODE',
    language: 'java',
    similes: ['RUN_JAVA', 'EXECUTE_JAVA', 'RUN_JAVAC', 'EXECUTE_JAVAC'],
    description: 'Executes Java code in a secure sandboxed environment',
    examples: [
        [
            {
                user: '{{name1}}',
                content: {
                    text: 'public class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
                },
            },
            {
                user: '{{name2}}',
                content: {
                    text: 'Hello, World!',
                    stdout: 'Hello, World!',
                    actions: ['EXECUTE_JAVA_CODE'],
                },
            },
        ],
    ]
})

export default executeJavaAction;