import type { CodeResponse } from 'src/types';

export const parseCodeResposnse = (response: CodeResponse) => {
    const stdout = response.logs.stdout[0];
    const stderr = response.logs.stderr[0];
    const results = response.results;
    return { stdout, stderr, results };
}