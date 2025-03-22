export type CodeResponse = {
    results: string[];
    logs: {
        stdout: string[];
        stderr: string[];
    };
    error: {
        name: string;
        value: string;
        traceback: string;
    }
}