/**
 * Proper Error Types - No more 'any' BS
 * Uncle Frank says: "Know your errors or they'll know you"
 */

export interface SystemError extends Error {
    code?: string | number;
    syscall?: string;
    path?: string;
    errno?: number;
}

export interface AxiosErrorType extends Error {
    response?: {
        status: number;
        data: any;
        headers: Record<string, string>;
    };
    request?: any;
    config?: any;
}

export interface ExecError extends Error {
    code: number;
    signal?: string;
    stdout?: string;
    stderr?: string;
    cmd?: string;
}

/**
 * Type guard for system errors (file system, network)
 */
export function isSystemError(error: unknown): error is SystemError {
    return error instanceof Error && 'code' in error;
}

/**
 * Type guard for axios errors
 */
export function isAxiosError(error: unknown): error is AxiosErrorType {
    return error instanceof Error && 'response' in error;
}

/**
 * Type guard for exec errors
 */
export function isExecError(error: unknown): error is ExecError {
    return error instanceof Error && 'code' in error && typeof (error as any).code === 'number';
}

/**
 * Safe error message extraction
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
        return String(error.message);
    }
    return 'Unknown error';
}

/**
 * Safe error code extraction
 */
export function getErrorCode(error: unknown): string | number | undefined {
    if (isSystemError(error)) {
        return error.code;
    }
    if (isExecError(error)) {
        return error.code;
    }
    if (isAxiosError(error)) {
        return error.response?.status;
    }
    return undefined;
}