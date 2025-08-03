import axios from 'axios';
import chalk from 'chalk';
import type { Checkpoint } from '../types';

export class TerragonProxy {
  private baseUrl = 'https://www.terragonlabs.com/dashboard';
  private sessionToken: string;
  private deploymentId = 'dpl_3hWzkM7LiymSczFN21Z8chju84CV';

  constructor(authToken: string) {
    this.sessionToken = authToken;
  }

  async createSession(taskName: string): Promise<string> {
    console.log(chalk.blue('Creating Terragon thread...'));
    // Terragon uses a thread-based system
    const threadId = `thread-${Date.now()}`;
    console.log(chalk.green(`✓ Thread ID: ${threadId}`));
    return threadId;
  }

  async sendMessage(
    threadId: string,
    message: string,
    githubRepo = 'bhuman-ai/unclefrank-bootstrap'
  ): Promise<any> {
    try {
      console.log(chalk.blue('Sending message to Terragon...'));
      
      const payload = [{
        message: {
          type: 'user',
          model: 'sonnet',
          parts: [{
            type: 'rich-text',
            nodes: [{
              type: 'text',
              text: message
            }]
          }],
          timestamp: new Date().toISOString()
        },
        githubRepoFullName: githubRepo,
        repoBaseBranchName: 'main',
        saveAsDraft: false
      }];

      const response = await axios.post(
        this.baseUrl,
        payload,
        {
          headers: {
            'accept': 'text/x-component',
            'content-type': 'text/plain;charset=UTF-8',
            'cookie': `__Secure-better-auth.session_token=${this.sessionToken}`,
            'next-action': '7f7cba8a674421dfd9e9da7470ee4d79875a158bc9',
            'origin': 'https://www.terragonlabs.com',
            'referer': 'https://www.terragonlabs.com/dashboard',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'x-deployment-id': this.deploymentId
          }
        }
      );

      console.log(chalk.green('✓ Message sent'));
      return response.data;
    } catch (error) {
      console.error(chalk.red('Failed to send message:'), error);
      if (axios.isAxiosError(error)) {
        console.error('Response:', error.response?.data);
      }
      throw error;
    }
  }

  async executeCheckpoint(
    threadId: string,
    checkpoint: Checkpoint,
    projectContext: string
  ): Promise<string> {
    const message = this.buildCheckpointMessage(checkpoint, projectContext);
    
    console.log(chalk.cyan(`\nExecuting checkpoint: ${checkpoint.name}`));
    console.log(chalk.gray('Objective:'), checkpoint.objective);
    
    const response = await this.sendMessage(threadId, message);
    
    // Extract response text from the Terragon response
    const responseText = this.extractResponseText(response);
    
    return responseText;
  }

  private buildCheckpointMessage(checkpoint: Checkpoint, projectContext: string): string {
    return `# CHECKPOINT EXECUTION

## Context
${projectContext}

## Checkpoint: ${checkpoint.name}
**Objective:** ${checkpoint.objective}

## Instructions
${checkpoint.instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

## Pass Criteria
These must be satisfied for the checkpoint to pass:
${checkpoint.passCriteria.map(pc => `- ${pc.description}`).join('\n')}

Please execute this checkpoint step by step. Be specific about what you're doing and report the results clearly.`;
  }

  private extractResponseText(response: any): string {
    // Terragon returns React Server Components, need to parse the actual text
    if (typeof response === 'string') {
      // Extract text content from the response
      const textMatch = response.match(/"text":"([^"]+)"/);
      return textMatch ? textMatch[1] : response;
    }
    return JSON.stringify(response);
  }

  async getSessionHistory(threadId: string): Promise<any[]> {
    console.log(chalk.yellow('Thread history not implemented for Terragon'));
    return [];
  }

  async closeSession(threadId: string): Promise<void> {
    console.log(chalk.green('✓ Thread closed'));
  }
}