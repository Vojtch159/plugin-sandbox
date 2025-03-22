export type CodeResponse = {
    results: string[];
    logs: {
        stdout: string[];
        stderr: string[];
    };
}