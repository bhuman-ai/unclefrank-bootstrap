/**
 * GitHub Draft Storage
 * REAL PRINCIPLE: GitHub IS the database. No BS PostgreSQL needed.
 * Uncle Frank says: "Why add a database when GitHub already stores everything?"
 */

import { Octokit } from '@octokit/rest';

export interface GitHubDraft {
    issueNumber: number;
    title: string;
    content: string;
    type: 'project' | 'task' | 'checkpoint' | 'documentation';
    status: 'draft' | 'validated' | 'approved' | 'rejected';
    labels: string[];
    created: Date;
    url: string;
}

export class GitHubDraftStorage {
    private octokit: Octokit;
    private owner: string;
    private repo: string;
    private rateLimitRemaining: number = 5000;
    private rateLimitReset: Date = new Date();

    constructor() {
        this.octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN,
            throttle: {
                onRateLimit: (retryAfter: number, options: any) => {
                    console.warn(`⚠️ GitHub rate limit hit! Retrying after ${retryAfter} seconds`);
                    return true; // Retry
                },
                onSecondaryRateLimit: (retryAfter: number, options: any) => {
                    console.warn(`⚠️ GitHub secondary rate limit hit!`);
                    return true;
                }
            }
        });
        
        // Parse from GITHUB_REPO env var or use defaults
        const repoPath = process.env.GITHUB_REPO || 'bhuman-ai/unclefrank-bootstrap';
        const parts = repoPath.split('/');
        this.owner = parts[0] || 'bhuman-ai';
        this.repo = parts[1] || 'unclefrank-bootstrap';
        
        // Check rate limit on startup
        this.checkRateLimit();
    }

    /**
     * Check and update rate limit status
     */
    private async checkRateLimit(): Promise<boolean> {
        try {
            const { data } = await this.octokit.rateLimit.get();
            this.rateLimitRemaining = data.rate.remaining;
            this.rateLimitReset = new Date(data.rate.reset * 1000);
            
            if (this.rateLimitRemaining < 100) {
                console.warn(`⚠️ Low GitHub rate limit: ${this.rateLimitRemaining} remaining`);
                if (this.rateLimitRemaining < 10) {
                    const waitTime = this.rateLimitReset.getTime() - Date.now();
                    throw new Error(`GitHub rate limit exceeded. Resets in ${Math.ceil(waitTime / 60000)} minutes`);
                }
            }
            
            return true;
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Rate limit check failed:', err.message);
            return false;
        }
    }

    /**
     * Create a draft as a GitHub Issue
     * This IS our database - no PostgreSQL BS needed
     */
    async createDraft(
        title: string,
        content: string,
        type: 'project' | 'task' | 'checkpoint' | 'documentation'
    ): Promise<GitHubDraft> {
        console.log(`📝 Creating draft as GitHub Issue: ${title}`);
        
        // Check rate limit before operation
        await this.checkRateLimit();
        
        try {
            const { data } = await this.octokit.issues.create({
                owner: this.owner,
                repo: this.repo,
                title: `[DRAFT] ${title}`,
                body: this.formatDraftBody(content, type),
                labels: ['draft', type, 'uncle-frank']
            });

            return {
                issueNumber: data.number,
                title,
                content,
                type,
                status: 'draft',
                labels: data.labels.map((l: any) => l.name),
                created: new Date(data.created_at),
                url: data.html_url
            };
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Failed to create draft:', err.message);
            throw new Error(`GitHub draft creation failed: ${err.message}`);
        }
    }

    /**
     * Get all drafts (GitHub Issues with 'draft' label)
     */
    async getDrafts(status?: string): Promise<GitHubDraft[]> {
        console.log('📋 Fetching drafts from GitHub Issues...');
        
        try {
            const labels = ['draft'];
            if (status) {
                labels.push(status);
            }

            const { data } = await this.octokit.issues.listForRepo({
                owner: this.owner,
                repo: this.repo,
                labels: labels.join(','),
                state: 'open',
                per_page: 100
            });

            return data.map(issue => this.issueToGraft(issue));
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Failed to fetch drafts:', err.message);
            return [];
        }
    }

    /**
     * Update draft status by adding/removing labels
     */
    async updateDraftStatus(
        issueNumber: number,
        newStatus: 'validated' | 'approved' | 'rejected'
    ): Promise<GitHubDraft> {
        console.log(`📝 Updating draft #${issueNumber} to ${newStatus}`);
        
        try {
            // Remove old status labels
            const statusLabels = ['draft', 'validated', 'approved', 'rejected'];
            for (const label of statusLabels) {
                try {
                    await this.octokit.issues.removeLabel({
                        owner: this.owner,
                        repo: this.repo,
                        issue_number: issueNumber,
                        name: label
                    });
                } catch {
                    // Label might not exist, that's fine
                }
            }

            // Add new status label
            await this.octokit.issues.addLabels({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber,
                labels: [newStatus]
            });

            // Update title if approved
            if (newStatus === 'approved') {
                const { data: issue } = await this.octokit.issues.get({
                    owner: this.owner,
                    repo: this.repo,
                    issue_number: issueNumber
                });

                await this.octokit.issues.update({
                    owner: this.owner,
                    repo: this.repo,
                    issue_number: issueNumber,
                    title: issue.title.replace('[DRAFT]', '[APPROVED]')
                });
            }

            // Get updated issue
            const { data } = await this.octokit.issues.get({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber
            });

            return this.issueToGraft(data);
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Failed to update draft status:', err.message);
            throw new Error(`Status update failed: ${err.message}`);
        }
    }

    /**
     * Convert approved draft (Issue) to Pull Request
     * REAL IMPLEMENTATION: Actually creates branch and commit first
     */
    async convertDraftToPR(issueNumber: number): Promise<number> {
        console.log(`🚀 Converting draft #${issueNumber} to PR...`);
        
        try {
            // Get the issue content
            const { data: issue } = await this.octokit.issues.get({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber
            });

            // Step 1: Get the SHA of main branch
            const { data: ref } = await this.octokit.git.getRef({
                owner: this.owner,
                repo: this.repo,
                ref: 'heads/main'
            });

            // Step 2: Create a new branch from main
            const branchName = `draft-${issueNumber}-${Date.now()}`;
            await this.octokit.git.createRef({
                owner: this.owner,
                repo: this.repo,
                ref: `refs/heads/${branchName}`,
                sha: ref.object.sha
            });

            // Step 3: Create a task file in the new branch
            const taskContent = `# Task from Draft #${issueNumber}

${issue.title.replace(/^\[(DRAFT|APPROVED|VALIDATED|REJECTED)\]\s*/, '')}

## Description
${issue.body}

## Original Issue
- Issue: #${issueNumber}
- Created: ${issue.created_at}
- Labels: ${issue.labels.map((l: any) => l.name).join(', ')}

---
*Generated from draft by Uncle Frank's platform*`;

            await this.octokit.repos.createOrUpdateFileContents({
                owner: this.owner,
                repo: this.repo,
                path: `tasks/task-${issueNumber}.md`,
                message: `Add task from draft #${issueNumber}`,
                content: Buffer.from(taskContent).toString('base64'),
                branch: branchName
            });
            
            // Step 4: NOW create the PR (branch exists with content!)
            const { data: pr } = await this.octokit.pulls.create({
                owner: this.owner,
                repo: this.repo,
                title: issue.title.replace('[APPROVED]', '[TASK]'),
                head: branchName,
                base: 'main',
                body: `## Implements #${issueNumber}

${issue.body}

---
### Checklist
- [ ] Implementation complete
- [ ] Tests added/updated
- [ ] Documentation updated

Closes #${issueNumber}`
            });

            // Close the original issue
            await this.octokit.issues.update({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber,
                state: 'closed',
                state_reason: 'completed'
            });

            console.log(`✅ Created PR #${pr.number} from draft #${issueNumber}`);
            return pr.number;
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Failed to convert draft to PR:', err.message);
            throw new Error(`PR conversion failed: ${err.message}`);
        }
    }

    /**
     * Delete a draft (close the issue)
     */
    async deleteDraft(issueNumber: number): Promise<boolean> {
        console.log(`🗑️ Deleting draft #${issueNumber}`);
        
        try {
            await this.octokit.issues.update({
                owner: this.owner,
                repo: this.repo,
                issue_number: issueNumber,
                state: 'closed',
                state_reason: 'not_planned'
            });
            return true;
        } catch (error: unknown) {
            const err = error as Error;
            console.error('Failed to delete draft:', err.message);
            return false;
        }
    }

    /**
     * Format draft body with metadata
     */
    private formatDraftBody(content: string, type: string): string {
        return `## Draft Type: ${type}

${content}

---
*Created by Uncle Frank's Autonomous Platform*
*This is a DRAFT - not yet approved for implementation*`;
    }

    /**
     * Convert GitHub Issue to Draft object
     */
    private issueToGraft(issue: any): GitHubDraft {
        const labels = issue.labels.map((l: any) => l.name);
        let status: GitHubDraft['status'] = 'draft';
        
        if (labels.includes('approved')) status = 'approved';
        else if (labels.includes('validated')) status = 'validated';
        else if (labels.includes('rejected')) status = 'rejected';

        let type: GitHubDraft['type'] = 'task';
        if (labels.includes('project')) type = 'project';
        else if (labels.includes('checkpoint')) type = 'checkpoint';
        else if (labels.includes('documentation')) type = 'documentation';

        return {
            issueNumber: issue.number,
            title: issue.title.replace(/^\[(DRAFT|APPROVED|VALIDATED|REJECTED)\]\s*/, ''),
            content: issue.body || '',
            type,
            status,
            labels,
            created: new Date(issue.created_at),
            url: issue.html_url
        };
    }
}

// Export singleton
export const githubDraftStorage = new GitHubDraftStorage();