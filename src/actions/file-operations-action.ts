import {
    type Action,
    type Content,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    ServiceType,
    elizaLogger as logger,
} from '@elizaos/core';
import SandboxService from '../sandbox-service';
import { extractSourceId } from '../utils';

// Supported file operations
const FILE_READ_ACTION = 'readFile';
const FILE_WRITE_ACTION = 'writeFile';

interface FileReadRequest {
    path: string;
}

interface FileWriteRequest {
    path: string;
    content: string;
    isMultiple?: boolean;
    files?: Array<{path: string, data: string}>;
}

async function getSandboxForUser(sourceId: string) {
    try {
        return await SandboxService.getSandbox(sourceId);
    } catch (error) {
        logger.error(`Error getting sandbox for user ${sourceId}:`, error);
        return null;
    }
}

async function handleError(
    errorMessage: string,
    message: Memory,
    callback: HandlerCallback,
    action: string
): Promise<Content> {
    logger.error(errorMessage);

    const errorContent: Content = {
        text: `Error ${action === FILE_READ_ACTION ? 'reading from' : 'writing to'} file: \n${errorMessage}`,
        actions: [action],
        source: message.content?.source,
    };

    await callback(errorContent);
    return errorContent;
}

/**
 * Extracts file path from natural language text
 * Handles patterns like "read file at /path/to/file.txt" or "read /path/to/file.txt"
 */
function extractFilePath(text: string): string | null {
    // Match patterns like "read file at /path/to/file.txt" or "read /path/to/file.txt"
    const readPatterns = [
        /read\s+(?:file|from|content|contents)?\s+(?:at|from|path|located at)?\s+['"]?([^'"<>\s]+)['"]?/i,
        /(?:get|fetch|retrieve)\s+(?:file|content|contents)?\s+(?:at|from|path|located at)?\s+['"]?([^'"<>\s]+)['"]?/i,
        /(?:file|path)\s+['"]?([^'"<>\s]+)['"]?/i
    ];

    for (const pattern of readPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

/**
 * Extracts file path and content from natural language text
 * Handles patterns like "write 'hello world' to /path/to/file.txt"
 */
function extractFileWriteInfo(text: string): { path: string | null, content: string | null } {
    // Match patterns for file path
    const pathPatterns = [
        /(?:write|save|create|put)\s+(?:file|content|contents)?\s+(?:to|at|in|path)?\s+['"]?([^'"<>\s]+)['"]?/i,
        /(?:file|path)\s+['"]?([^'"<>\s]+)['"]?/i,
        /(?:to|at|in)\s+['"]?([^'"<>\s]+)['"]?/i  // Added pattern to catch "to /path/to/file.txt"
    ];

    let path: string | null = null;

    for (const pattern of pathPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            path = match[1];
            break;
        }
    }

    // Look for content between quotes or after "with content" or similar phrases
    let content: string | null = null;

    // Try to find content between quotes
    const contentQuoteMatch = text.match(/['"]([^'"]+)['"]/);
    if (contentQuoteMatch) {
        content = contentQuoteMatch[1];
    } else {
        // Try to find content after "with content" or similar
        const contentMatch = text.match(/(?:with|content|contents|data)\s+(?:of|is|as)?\s+(.*?)(?:$|to file|to path)/i);
        if (contentMatch) {
            content = contentMatch[1].trim();
        } else {
            // Check for specific patterns like "Write X to Y"
            const writeContentMatch = text.match(/(?:write|save|create|put)\s+["']?([^"']+?)["']?\s+(?:to|at|in)/i);
            if (writeContentMatch) {
                content = writeContentMatch[1].trim();
            } else if (path) {
                // If we have a path but no explicit content, look for any text after the path
                const afterPathMatch = text.match(new RegExp(`${path}\\s+(.+)$`, 'i'));
                if (afterPathMatch) {
                    content = afterPathMatch[1].trim();
                } else {
                    // Look for any text before the path that might be content
                    const beforePathMatch = text.match(/^(.*?)\s+(?:to|at|in)\s+['"]?[^'"<>\s]+['"]?/i);
                    if (beforePathMatch && beforePathMatch[1] && !beforePathMatch[1].match(/^(?:write|save|create|put)\s*$/i)) {
                        content = beforePathMatch[1].replace(/^(?:write|save|create|put)\s+/i, '').trim();
                    }
                }
            }
        }
    }

    logger.debug(`Extracted path: ${path}, content: ${content} from text: ${text}`);
    return { path, content };
}

// File read action
export const fileReadAction: Action = {
    name: FILE_READ_ACTION,
    similes: ['readFileFromSandbox', 'getFileContent'],
    description: 'Read the contents of a file from the sandbox filesystem',

    validate: async (runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
        try {
            // First try to parse as JSON
            try {
                const request = JSON.parse(message.content?.text || '{}') as FileReadRequest;
                return !!request.path;
            } catch (jsonError) {
                // If JSON parsing fails, try to extract file path from natural language
                const text = message.content?.text || '';
                const filePath = extractFilePath(text);
                return !!filePath;
            }
        } catch (error) {
            return false;
        }
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback,
    ) => {
        try {
            logger.info(`Handling ${FILE_READ_ACTION} action`);

            // Parse request - try JSON first, then natural language
            let filePath: string;
            try {
                const request = JSON.parse(message.content?.text || '{}') as FileReadRequest;
                filePath = request.path;
            } catch (jsonError) {
                // Extract file path from natural language
                const extractedPath = extractFilePath(message.content?.text || '');
                if (!extractedPath) {
                    return handleError('No file path provided or could not parse file path from message', message, callback, FILE_READ_ACTION);
                }
                filePath = extractedPath;
            }

            if (!filePath) {
                return handleError('No file path provided', message, callback, FILE_READ_ACTION);
            }

            // Get user identifier
            const sourceId = extractSourceId(message);

            // Get the sandbox service
            const sandboxService = runtime.getService('e2b-sandbox' as ServiceType) as SandboxService;
            if (!sandboxService) {
                return handleError('E2B Sandbox service not found', message, callback, FILE_READ_ACTION);
            }

            // Get sandbox for this user
            const sandbox = await getSandboxForUser(sourceId);
            if (!sandbox) {
                return handleError('Failed to initialize sandbox', message, callback, FILE_READ_ACTION);
            }

            // Read the file
            logger.info(`Reading file ${filePath} for user ${sourceId}`);
            const fileContent = await sandbox.files.read(filePath);

            // Return the file content
            const responseContent: Content = {
                text: `File content read successfully:\n\n${fileContent}`,
                data: fileContent,
                actions: [FILE_READ_ACTION],
                source: message.content.source
            };

            await callback(responseContent);
            return responseContent;
        } catch (error) {
            return handleError(`Error in file read action: ${error}`, message, callback, FILE_READ_ACTION);
        }
    },

    examples: [
        [
            {
                user: '{{name1}}',
                content: {
                    text: '{"path": "/path/to/file.txt"}',
                },
            },
            {
                user: '{{name2}}',
                content: {
                    text: 'File content read successfully:\n\nHello, world!',
                    actions: [FILE_READ_ACTION],
                },
            },
        ],
        [
            {
                user: '{{name1}}',
                content: {
                    text: 'Read file at /path/to/file.txt',
                },
            },
            {
                user: '{{name2}}',
                content: {
                    text: 'File content read successfully:\n\nHello, world!',
                    actions: [FILE_READ_ACTION],
                },
            },
        ]
    ],
};

// File write action
export const fileWriteAction: Action = {
    name: FILE_WRITE_ACTION,
    similes: ['writeFileToSandbox', 'saveFileContent'],
    description: 'Write content to a file in the sandbox filesystem',

    validate: async (runtime: IAgentRuntime, message: Memory, _state: State): Promise<boolean> => {
        try {
            // First try to parse as JSON
            try {
                const request = JSON.parse(message.content?.text || '{}') as FileWriteRequest;
                if (request.isMultiple && Array.isArray(request.files)) {
                    return request.files.every(file => !!file.path && file.data !== undefined);
                }
                return !!request.path && request.content !== undefined;
            } catch (jsonError) {
                // If JSON parsing fails, try to extract file path and content from natural language
                const text = message.content?.text || '';
                const { path, content } = extractFileWriteInfo(text);
                return !!path && !!content;
            }
        } catch (error) {
            return false;
        }
    },

    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        options: any,
        callback: HandlerCallback,
    ) => {
        try {
            logger.info(`Handling ${FILE_WRITE_ACTION} action`);

            // Parse request - try JSON first, then natural language
            let request: FileWriteRequest;
            try {
                request = JSON.parse(message.content?.text || '{}') as FileWriteRequest;
            } catch (jsonError) {
                // Extract file path and content from natural language
                const { path, content } = extractFileWriteInfo(message.content?.text || '');
                logger.info(`Extracted path: ${path}, content: ${content}`);
                if (!path || !content) {
                    return handleError('Could not parse file path and content from message', message, callback, FILE_WRITE_ACTION);
                }
                request = { path, content };
            }

            // Validate request
            if (request.isMultiple) {
                if (!request.files || !Array.isArray(request.files) || request.files.length === 0) {
                    return handleError('No files provided for multiple file write', message, callback, FILE_WRITE_ACTION);
                }
            } else if (!request.path || request.content === undefined) {
                return handleError('No file path or content provided', message, callback, FILE_WRITE_ACTION);
            }

            // Get user identifier
            const sourceId = extractSourceId(message);

            // Get the sandbox service
            const sandboxService = runtime.getService('e2b-sandbox' as ServiceType) as SandboxService;
            if (!sandboxService) {
                return handleError('E2B Sandbox service not found', message, callback, FILE_WRITE_ACTION);
            }

            // Get sandbox for this user
            const sandbox = await getSandboxForUser(sourceId);
            if (!sandbox) {
                return handleError('Failed to initialize sandbox', message, callback, FILE_WRITE_ACTION);
            }

            // Write the file(s)
            if (request.isMultiple && request.files) {
                logger.info(`Writing multiple files for user ${sourceId}`);
                await sandbox.files.write(request.files);

                const fileList = request.files.map(file => file.path).join('\n- ');
                const responseContent: Content = {
                    text: `Successfully wrote multiple files:\n- ${fileList}`,
                    actions: [FILE_WRITE_ACTION],
                    source: message.content.source
                };

                await callback(responseContent);
                return responseContent;
            } else {
                logger.info(`Writing file ${request.path} for user ${sourceId}`);
                const res = await sandbox.files.write(request.path, request.content);
                logger.info(`Write result: ${res}`);

                const responseContent: Content = {
                    text: `Successfully wrote file: ${request.path}`,
                    actions: [FILE_WRITE_ACTION],
                    source: message.content.source
                };

                await callback(responseContent);
                return responseContent;
            }
        } catch (error) {
            return handleError(`Error in file write action: ${error}`, message, callback, FILE_WRITE_ACTION);
        }
    },

    examples: [
        [
            {
                user: '{{name1}}',
                content: {
                    text: '{"path": "/path/to/file.txt", "content": "Hello, world!"}',
                },
            },
            {
                user: '{{name2}}',
                content: {
                    text: 'Successfully wrote file: /path/to/file.txt',
                    actions: [FILE_WRITE_ACTION],
                },
            },
        ],
        [
            {
                user: '{{name1}}',
                content: {
                    text: 'Write "Hello, world!" to /path/to/file.txt',
                },
            },
            {
                user: '{{name2}}',
                content: {
                    text: 'Successfully wrote file: /path/to/file.txt',
                    actions: [FILE_WRITE_ACTION],
                },
            },
        ]
    ],
};