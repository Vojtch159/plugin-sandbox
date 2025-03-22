import { createCodeExecutionAction } from './create-code-execution-action';

const executeJavaScriptAction = createCodeExecutionAction({
    name: 'EXECUTE_JAVASCRIPT_CODE',
    language: 'javascript',
    similes: ['RUN_JAVASCRIPT', 'EXECUTE_JS', 'RUN_JS'],
    description: 'Executes JavaScript code in a secure sandboxed environment',
    examples: [
        [
            {
                user: '{{name1}}',
                content: {
                    text: 'console.log([1, 2, 3].map(x => x * 2));',
                },
            },
            {
                user: '{{name2}}',
                content: {
                    text: '[ 2, 4, 6 ]',
                    stdout: '[ 2, 4, 6 ]',
                    actions: ['EXECUTE_JAVASCRIPT_CODE'],
                },
            },
        ],
    ],
});

export default executeJavaScriptAction;
