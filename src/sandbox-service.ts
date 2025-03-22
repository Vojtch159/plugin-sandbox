import {
    type IAgentRuntime,
    Service,
    type ServiceType,
    elizaLogger as logger,
} from '@elizaos/core';
import { Sandbox } from '@e2b/code-interpreter';

class SandboxService extends Service {
    static serviceType = 'e2b-sandbox' as ServiceType;
    capabilityDescription = 'This service provides a secure sandboxed environment for executing Python code.';
    sandboxes: Map<string, Sandbox> = new Map();

    constructor(protected runtime: IAgentRuntime) {
        super();
    }

    async initialize() {
        logger.info(`*** Initializing E2B Sandbox service: ${new Date().toISOString()} ***`);
        const apiKey = this.runtime.getSetting("E2B_API_KEY") as string;
        if (!apiKey) {
            throw new Error("E2B_API_KEY is not set");
        }
    }

    static async initialize(runtime: IAgentRuntime) {
        logger.info(`*** Initializing E2B Sandbox service: ${new Date().toISOString()} ***`);
        const apiKey = runtime.getSetting("E2B_API_KEY") as string;
        if (!apiKey) {
            throw new Error("E2B_API_KEY is not set");
        }
    }

    static async start(runtime: IAgentRuntime) {
        logger.info(`*** Starting E2B Sandbox service: ${new Date().toISOString()} ***`);
        const service = new SandboxService(runtime);
        return service;
    }

    static async stop(runtime: IAgentRuntime) {
        logger.info('*** Stopping E2B Sandbox service ***');
        const service = runtime.getService(SandboxService.serviceType);
        if (!service) {
            throw new Error('E2B Sandbox service not found');
        }
        await (service as SandboxService).stop();
    }

    async stop() {
        logger.info('*** Closing all E2B sandboxes ***');
        // Close all active sandboxes
        const closingPromises = [];
        for (const [id, sandbox] of this.sandboxes.entries()) {
            logger.info(`Closing sandbox: ${id}`);
            // Use terminate() instead of close() for E2B API
            closingPromises.push(sandbox.kill());
            this.sandboxes.delete(id);
        }
        await Promise.all(closingPromises);
    }

    static async getSandbox(userId: string): Promise<Sandbox> {
        // Create a new sandbox
        logger.info(`Creating new E2B sandbox for user: ${userId}`);
        try {
            const sandbox = await Sandbox.create();
            return sandbox;
        } catch (error) {
            logger.error(`Error creating E2B sandbox: ${error}`);
            throw error;
        }
    }

    async closeSandbox(userId: string): Promise<void> {
        if (this.sandboxes.has(userId)) {
            const sandbox = this.sandboxes.get(userId)!;
            // Use terminate() instead of close() for E2B API
            await sandbox.kill();
            this.sandboxes.delete(userId);
            logger.info(`Closed sandbox for user: ${userId}`);
        }
    }
}

export default SandboxService;