import e2bSandboxPlugin from "../src/index";

// Example plugin test
export const testSuite = {
    name: 'discord_plugin_tests',
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
                        await Promise.all(e2bSandboxPlugin.services.map(service => {
                            return service.start(runtime);
                        }));

                        // Check if the sandbox service is registered
                        const service = runtime.getService('e2b-sandbox');
                        if (!service) {
                            throw new Error('E2B Sandbox service not found');
                        }

                        // Clean up
                        await Promise.all(e2bSandboxPlugin.services.map(service => {
                            return service.stop(runtime);
                        }));
                    },
                },
            ],
        },
    ],
};