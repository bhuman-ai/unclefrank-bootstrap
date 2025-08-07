/**
 * GitHub Integration for Task Tracking
 * Creates issues and manages task lifecycle in GitHub
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'bhuman-ai/unclefrank-bootstrap';
const GITHUB_API_BASE = 'https://api.github.com';

export interface TaskIssue {
  title: string;
  body: string;
  labels: string[];
  assignees?: string[];
}

export class GitHubIntegration {
  private headers: HeadersInit;

  constructor() {
    this.headers = {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  /**
   * Create a GitHub issue for task tracking
   */
  async createTaskIssue(
    request: string,
    sessionId: string,
    branch: string,
    checkpoints: any[],
    complexity: string,
    estimatedTime: string
  ): Promise<any> {
    const issueBody = this.formatIssueBody(
      request,
      sessionId,
      branch,
      checkpoints,
      complexity,
      estimatedTime
    );

    const issue: TaskIssue = {
      title: `[TASK] ${this.truncateTitle(request)}`,
      body: issueBody,
      labels: ['task', 'automated', complexity],
      assignees: []
    };

    try {
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/issues`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(issue)
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create GitHub issue: ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('GitHub issue creation failed:', error);
      // Don't fail the task execution if issue creation fails
      return null;
    }
  }

  /**
   * Update an existing issue with execution progress
   */
  async updateTaskIssue(issueNumber: number, update: string): Promise<void> {
    try {
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/issues/${issueNumber}/comments`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({ body: update })
        }
      );

      if (!response.ok) {
        console.error('Failed to update issue:', await response.text());
      }
    } catch (error) {
      console.error('GitHub issue update failed:', error);
    }
  }

  /**
   * Format the issue body with task details
   */
  private formatIssueBody(
    request: string,
    sessionId: string,
    branch: string,
    checkpoints: any[],
    complexity: string,
    estimatedTime: string
  ): string {
    const now = new Date().toISOString();
    
    let body = `## Task Details\n\n`;
    body += `**Request:** ${request}\n\n`;
    body += `**Session ID:** ${sessionId}\n`;
    body += `**Branch:** ${branch}\n`;
    body += `**Status:** executing\n\n`;
    
    body += `## Checkpoints\n\n`;
    checkpoints.forEach((cp, index) => {
      body += `- [ ] **${cp.name}**\n`;
      body += `  - Description: ${cp.description}\n`;
      body += `  - Pass/Fail: ${cp.passFail}\n`;
      body += `  - Status: ${cp.status}\n\n`;
    });
    
    body += `## Execution Log\n\n`;
    body += `**Start Time:** ${now}\n`;
    body += `**Claude Instance:** uncle-frank-claude.fly.dev\n`;
    body += `**Complexity:** ${complexity}\n`;
    body += `**Estimated Time:** ${estimatedTime}\n\n`;
    
    body += `## Review Checklist\n\n`;
    body += `- [ ] All checkpoints completed successfully\n`;
    body += `- [ ] Code follows project standards (CLAUDE.md)\n`;
    body += `- [ ] Tests pass\n`;
    body += `- [ ] No security issues introduced\n`;
    body += `- [ ] Documentation updated if needed\n\n`;
    
    body += `---\n`;
    body += `*This issue was automatically created by Uncle Frank's Task Execution System*`;
    
    return body;
  }

  /**
   * Truncate title to GitHub's limit
   */
  private truncateTitle(request: string): string {
    const maxLength = 100;
    const cleaned = request.replace(/\n/g, ' ').trim();
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    return cleaned.substring(0, maxLength - 3) + '...';
  }

  /**
   * Create a pull request for the task branch
   */
  async createPullRequest(
    branch: string,
    title: string,
    description: string,
    issueNumber?: number
  ): Promise<any> {
    const body = issueNumber 
      ? `${description}\n\nCloses #${issueNumber}`
      : description;

    try {
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/pulls`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            title: `[TASK] ${title}`,
            body,
            head: branch,
            base: 'main',
            draft: false
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create pull request: ${error}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Pull request creation failed:', error);
      return null;
    }
  }
}

// Export singleton instance
export const githubIntegration = new GitHubIntegration();