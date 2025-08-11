/**
 * GitHub Error Handler
 * SACRED PRINCIPLE: Handle errors gracefully, don't crash
 * Uncle Frank says: "When GitHub fails, have a backup plan"
 */

import axios, { AxiosError } from 'axios';
import { Octokit } from '@octokit/rest';

export interface GitHubError {
    type: 'rate_limit' | 'auth' | 'not_found' | 'permission' | 'network' | 'unknown';
    message: string;
    retryable: boolean;
    retryAfter?: number;
    details?: any;
}

export interface GitHubOperation {
    operation: string;
    maxRetries?: number;
    retryDelay?: number;
    fallback?: () => Promise<any>;
}

export class GitHubErrorHandler {
    private octokit: Octokit;
    private rateLimitRemaining: number = 5000;
    private rateLimitReset: Date = new Date();
    
    constructor(token?: string) {
        this.octokit = new Octokit({
            auth: token || process.env.GITHUB_TOKEN,
            retry: {
                enabled: false // We'll handle retries ourselves
            }
        });
    }

    /**
     * Execute a GitHub operation with proper error handling
     */
    async executeWithErrorHandling<T>(
        operation: () => Promise<T>,
        config: GitHubOperation
    ): Promise<T | null> {
        console.log(`🔧 Frank is executing GitHub operation: ${config.operation}`);
        
        const maxRetries = config.maxRetries || 3;
        const retryDelay = config.retryDelay || 2000;
        let lastError: GitHubError | null = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Check rate limit before attempting
                if (!this.hasRateLimitCapacity()) {
                    const waitTime = this.getWaitTimeForRateLimit();
                    console.log(`⏳ Rate limited. Waiting ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                
                // Execute the operation
                const result = await operation();
                
                // Update rate limit info if available
                await this.updateRateLimitInfo();
                
                console.log(`✅ GitHub operation succeeded: ${config.operation}`);
                return result;
                
            } catch (error) {
                lastError = this.parseGitHubError(error);
                console.log(`❌ Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
                
                // Determine if we should retry
                if (!lastError.retryable || attempt === maxRetries) {
                    break;
                }
                
                // Calculate retry delay
                const delay = lastError.retryAfter || (retryDelay * attempt);
                console.log(`⏰ Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        // All retries failed, try fallback
        if (config.fallback) {
            console.log('🔄 Attempting fallback strategy...');
            try {
                return await config.fallback();
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
            }
        }
        
        // Log final failure
        console.error(`❌ GitHub operation failed after ${maxRetries} attempts:`, lastError);
        return null;
    }

    /**
     * Parse GitHub error into structured format
     */
    private parseGitHubError(error: any): GitHubError {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            const response = axiosError.response;
            
            if (!response) {
                return {
                    type: 'network',
                    message: 'Network error - GitHub may be unreachable',
                    retryable: true,
                    details: error.message
                };
            }
            
            switch (response.status) {
                case 401:
                    return {
                        type: 'auth',
                        message: 'Authentication failed - check GitHub token',
                        retryable: false,
                        details: response.data
                    };
                    
                case 403:
                    // Check if it's rate limiting
                    if (response.headers['x-ratelimit-remaining'] === '0') {
                        const resetTime = parseInt(response.headers['x-ratelimit-reset'] || '0') * 1000;
                        return {
                            type: 'rate_limit',
                            message: 'GitHub API rate limit exceeded',
                            retryable: true,
                            retryAfter: resetTime - Date.now(),
                            details: {
                                limit: response.headers['x-ratelimit-limit'],
                                remaining: 0,
                                reset: new Date(resetTime)
                            }
                        };
                    }
                    return {
                        type: 'permission',
                        message: 'Permission denied - insufficient access rights',
                        retryable: false,
                        details: response.data
                    };
                    
                case 404:
                    return {
                        type: 'not_found',
                        message: 'Resource not found on GitHub',
                        retryable: false,
                        details: response.data
                    };
                    
                case 422:
                    return {
                        type: 'unknown',
                        message: 'Invalid request - validation failed',
                        retryable: false,
                        details: response.data
                    };
                    
                case 500:
                case 502:
                case 503:
                case 504:
                    return {
                        type: 'unknown',
                        message: 'GitHub server error',
                        retryable: true,
                        retryAfter: 5000,
                        details: response.data
                    };
                    
                default:
                    return {
                        type: 'unknown',
                        message: `GitHub API error: ${response.status}`,
                        retryable: response.status >= 500,
                        details: response.data
                    };
            }
        }
        
        return {
            type: 'unknown',
            message: error.message || 'Unknown GitHub error',
            retryable: false,
            details: error
        };
    }

    /**
     * Check if we have rate limit capacity
     */
    private hasRateLimitCapacity(): boolean {
        if (this.rateLimitRemaining <= 10) {
            if (new Date() < this.rateLimitReset) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get wait time until rate limit resets
     */
    private getWaitTimeForRateLimit(): number {
        const now = new Date().getTime();
        const reset = this.rateLimitReset.getTime();
        return Math.max(0, reset - now);
    }

    /**
     * Update rate limit info from GitHub
     */
    private async updateRateLimitInfo(): Promise<void> {
        try {
            const { data } = await this.octokit.rateLimit.get();
            this.rateLimitRemaining = data.rate.remaining;
            this.rateLimitReset = new Date(data.rate.reset * 1000);
        } catch (error) {
            console.log('Could not update rate limit info');
        }
    }

    /**
     * Create or update a file with error handling
     */
    async createOrUpdateFile(
        owner: string,
        repo: string,
        path: string,
        content: string,
        message: string,
        branch?: string
    ): Promise<boolean> {
        return await this.executeWithErrorHandling(
            async () => {
                // First, try to get the file to see if it exists
                let sha: string | undefined;
                try {
                    const { data } = await this.octokit.repos.getContent({
                        owner,
                        repo,
                        path,
                        ref: branch
                    });
                    
                    if (!Array.isArray(data) && data.type === 'file') {
                        sha = data.sha;
                    }
                } catch (error) {
                    // File doesn't exist, that's fine
                }
                
                // Create or update the file
                await this.octokit.repos.createOrUpdateFileContents({
                    owner,
                    repo,
                    path,
                    message,
                    content: Buffer.from(content).toString('base64'),
                    branch,
                    sha
                });
                
                return true;
            },
            {
                operation: `Create/Update file ${path}`,
                maxRetries: 3,
                fallback: async () => {
                    console.log('Fallback: Saving file locally instead');
                    // Save to local filesystem as fallback
                    const fs = await import('fs/promises');
                    const localPath = `/tmp/github-fallback/${repo}/${path}`;
                    await fs.mkdir(`/tmp/github-fallback/${repo}`, { recursive: true });
                    await fs.writeFile(localPath, content);
                    console.log(`File saved locally at: ${localPath}`);
                    return true;
                }
            }
        ) || false;
    }

    /**
     * Create an issue with error handling
     */
    async createIssue(
        owner: string,
        repo: string,
        title: string,
        body: string,
        labels?: string[]
    ): Promise<number | null> {
        const result = await this.executeWithErrorHandling(
            async () => {
                const { data } = await this.octokit.issues.create({
                    owner,
                    repo,
                    title,
                    body,
                    labels
                });
                return data.number;
            },
            {
                operation: `Create issue: ${title}`,
                maxRetries: 3,
                fallback: async () => {
                    console.log('Fallback: Creating local issue record');
                    // Save issue locally as fallback
                    const fs = await import('fs/promises');
                    const issueData = { title, body, labels, created: new Date() };
                    const issuePath = `/tmp/github-fallback/${repo}/issues/${Date.now()}.json`;
                    await fs.mkdir(`/tmp/github-fallback/${repo}/issues`, { recursive: true });
                    await fs.writeFile(issuePath, JSON.stringify(issueData, null, 2));
                    console.log(`Issue saved locally at: ${issuePath}`);
                    return -1; // Negative number indicates local storage
                }
            }
        );
        
        return result;
    }

    /**
     * Create a pull request with error handling
     */
    async createPullRequest(
        owner: string,
        repo: string,
        title: string,
        head: string,
        base: string,
        body: string
    ): Promise<number | null> {
        const result = await this.executeWithErrorHandling(
            async () => {
                const { data } = await this.octokit.pulls.create({
                    owner,
                    repo,
                    title,
                    head,
                    base,
                    body
                });
                return data.number;
            },
            {
                operation: `Create PR: ${title}`,
                maxRetries: 3,
                fallback: async () => {
                    console.log('Fallback: Creating issue instead of PR');
                    // Create an issue as fallback
                    return await this.createIssue(
                        owner,
                        repo,
                        `[PR Pending] ${title}`,
                        `This issue was created because PR creation failed.\n\nBranch: ${head}\nTarget: ${base}\n\n${body}`,
                        ['pr-pending']
                    );
                }
            }
        );
        
        return result;
    }

    /**
     * Check GitHub connectivity
     */
    async checkConnectivity(): Promise<{
        connected: boolean;
        authenticated: boolean;
        rateLimit?: any;
        error?: string;
    }> {
        try {
            // Try to get rate limit (doesn't count against limit)
            const { data } = await this.octokit.rateLimit.get();
            
            // Try to get authenticated user
            let authenticated = false;
            try {
                await this.octokit.users.getAuthenticated();
                authenticated = true;
            } catch {
                // Not authenticated
            }
            
            return {
                connected: true,
                authenticated,
                rateLimit: {
                    limit: data.rate.limit,
                    remaining: data.rate.remaining,
                    reset: new Date(data.rate.reset * 1000)
                }
            };
        } catch (error) {
            return {
                connected: false,
                authenticated: false,
                error: this.parseGitHubError(error).message
            };
        }
    }
}

// Export singleton
export const githubErrorHandler = new GitHubErrorHandler();