import { createCodeExecutionAction } from './create-code-execution-action';

const executeCodeAction = createCodeExecutionAction({
    name: 'EXECUTE_PYTHON_CODE',
    language: 'python',
    similes: ['RUN_PYTHON', 'EXECUTE_CODE', 'RUN_CODE'],
    description: 'Executes Python code in a secure sandboxed environment',
    examples: [
        [
            {
                user: '{{name1}}',
                content: {
                    text: 'import numpy as np\nprint(np.random.rand(5))',
                },
            },
            {
                user: '{{name2}}',
                content: {
                    text: '[0.42, 0.71, 0.29, 0.35, 0.63]',
                    stdout: '[0.42, 0.71, 0.29, 0.35, 0.63]',
                    actions: ['EXECUTE_PYTHON_CODE'],
                },
            },
        ],
    ],
});

export default executeCodeAction;