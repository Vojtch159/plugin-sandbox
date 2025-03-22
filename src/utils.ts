import type { CodeResponse } from 'src/types';
import type { Execution } from '@e2b/code-interpreter';
import type { Memory } from '@elizaos/core';

export const parseCodeResposnse = (response: Execution | string[] | string | undefined) => {
    if (!response) {
        return { stdout: '', stderr: '', results: [], error: null };
    }

    if (typeof response === 'string') {
        return { stdout: '', stderr: '', results: [response], error: null };
    }

    if (Array.isArray(response)) {
        return { stdout: '', stderr: '', results: response, error: null };
    }

    const stdout = response.logs.stdout?.[0];
    const stderr = response.logs.stderr?.[0];
    const results = response.results;
    const error = response.error;
    return { stdout, stderr, results, error };
}

export function extractSourceId(message: Memory): string {
    return typeof message.content?.source === 'object' && message.content?.source
        ? (message.content.source as { id?: string }).id || 'default-user'
        : 'default-user';
}