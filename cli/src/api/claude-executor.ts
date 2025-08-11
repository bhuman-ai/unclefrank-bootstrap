/**
 * Claude Executor API
 * Connects to Claude Code CLI instance on Fly.io to execute tasks
 */

const CLAUDE_FLY_URL = process.env.CLAUDE_FLY_URL || 'https://uncle-frank-claude.fly.dev';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'bhuman-ai/unclefrank-bootstrap';

interface ExecuteTaskRequest {
  task: string;
  repoUrl?: string;
  context?: {
    projectMd?: string;
    taskMd?: string;
    checkpoints?: any[];
  };
}

interface ClaudeSession {
  sessionId: string;
  status: string;
  branch: string;
  repoPath: string;
  githubUrl: string;
  tmuxSession: string;
  ready: boolean;
}

export class ClaudeExecutor {
  private sessionId: string | null = null;

  /**
   * Create a new Claude session on Fly.io
   */
  async createSession(repoUrl: string = `https://github.com/${GITHUB_REPO}`): Promise<ClaudeSession> {
    const response = await fetch(`${CLAUDE_FLY_URL}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ repoUrl }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create Claude session: ${error}`);
    }

    const session = await response.json();
    this.sessionId = session.sessionId;
    return session;
  }

  /**
   * Execute a task using Claude
   */
  async executeTask(request: ExecuteTaskRequest): Promise<any> {
    // Create a session if we don't have one
    if (!this.sessionId) {
      await this.createSession(request.repoUrl);
    }

    // Build the command for Claude
    const command = this.buildClaudeCommand(request);

    // Send the command to Claude
    const response = await fetch(`${CLAUDE_FLY_URL}/api/sessions/${this.sessionId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        message: command 
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to execute task: ${error}`);
    }

    return await response.json();
  }

  /**
   * Build the Claude command from the task request
   */
  private buildClaudeCommand(request: ExecuteTaskRequest): string {
    let command = `Hey Frank, here's what needs to get done:\n\n`;
    
    // Add the main task
    command += `TASK: ${request.task}\n\n`;

    // Add context if provided
    if (request.context) {
      if (request.context.projectMd) {
        command += `PROJECT CONTEXT:\n${request.context.projectMd}\n\n`;
      }
      
      if (request.context.taskMd) {
        command += `TASK DETAILS:\n${request.context.taskMd}\n\n`;
      }
      
      if (request.context.checkpoints && request.context.checkpoints.length > 0) {
        command += `CHECKPOINTS TO COMPLETE:\n`;
        request.context.checkpoints.forEach((checkpoint, index) => {
          command += `${index + 1}. ${checkpoint.name}: ${checkpoint.description}\n`;
          if (checkpoint.passFail) {
            command += `   Pass/Fail: ${checkpoint.passFail}\n`;
          }
        });
        command += '\n';
      }
    }

    // Add Frank's personality
    command += `Remember: No BS, no fluff. Just get it done. If something's unclear, ask. If it's broken, fix it. Let's go.`;

    return command;
  }

  /**
   * Get session status
   */
  async getSessionStatus(): Promise<any> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const response = await fetch(`${CLAUDE_FLY_URL}/api/sessions/${this.sessionId}`);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get session status: ${error}`);
    }

    return await response.json();
  }

  /**
   * Get session messages/output
   */
  async getSessionMessages(): Promise<any> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const response = await fetch(`${CLAUDE_FLY_URL}/api/sessions/${this.sessionId}/messages`);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get messages: ${error}`);
    }

    return await response.json();
  }

  /**
   * Close the session
   */
  async closeSession(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    await fetch(`${CLAUDE_FLY_URL}/api/sessions/${this.sessionId}`, {
      method: 'DELETE',
    });

    this.sessionId = null;
  }
}

// Export a singleton instance
export const claudeExecutor = new ClaudeExecutor();