import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import type { Checkpoint } from '../types';

interface TerragonMessage {
  type: 'user' | 'assistant';
  model: string;
  parts: Array<{
    type: 'rich-text';
    nodes: Array<{
      type: 'text';
      text: string;
    }>;
  }>;
  timestamp: string;
}

interface ChatListener {
  threadId: string;
  onMessage: (message: any) => void;
  onError?: (error: Error) => void;
}

export class TerragonProxy {
  private baseUrl = 'https://www.terragonlabs.com/dashboard';
  private sessionToken: string;
  private deploymentId = 'dpl_3hWzkM7LiymSczFN21Z8chju84CV';
  private axiosInstance: AxiosInstance;
  private activeListeners = new Map<string, NodeJS.Timeout>();
  private processedMessageIds = new Set<string>();
  private pollingInterval = 2000;

  constructor(authToken: string) {
    this.sessionToken = authToken;
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'accept': 'text/x-component',
        'content-type': 'text/plain;charset=UTF-8',
        'cookie': `__Secure-better-auth.session_token=${this.sessionToken}`,
        'next-action': '7f40cb55e87cce4b3543b51a374228296bc2436c6d',
        'origin': 'https://www.terragonlabs.com',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'x-deployment-id': this.deploymentId
      }
    });
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
    this.stopListening(threadId);
    console.log(chalk.green('✓ Thread closed'));
  }

  // Chat functionality
  async sendChatMessage(threadId: string, text: string): Promise<any> {
    try {
      console.log(chalk.blue(`[Chat] Sending message to thread ${threadId}...`));
      
      const payload = [{
        threadId,
        message: {
          type: 'user' as const,
          model: 'sonnet',
          parts: [{
            type: 'rich-text' as const,
            nodes: [{
              type: 'text' as const,
              text
            }]
          }],
          timestamp: new Date().toISOString()
        }
      }];

      const response = await this.axiosInstance.post(
        `/task/${threadId}`,
        payload,
        {
          headers: {
            'referer': `https://www.terragonlabs.com/task/${threadId}`
          }
        }
      );

      console.log(chalk.green('✓ Chat message sent'));
      return response.data;
    } catch (error) {
      console.error(chalk.red('Failed to send chat message:'), error);
      if (axios.isAxiosError(error)) {
        console.error('Response:', error.response?.data);
      }
      throw error;
    }
  }

  async startListening(threadId: string, onMessage: (message: any) => void, onError?: (error: Error) => void): Promise<void> {
    if (this.activeListeners.has(threadId)) {
      console.log(chalk.yellow(`Already listening to thread ${threadId}`));
      return;
    }

    console.log(chalk.green(`✓ Started listening to thread ${threadId}`));
    
    const pollMessages = async () => {
      try {
        const response = await this.axiosInstance.get(
          `/task/${threadId}`,
          {
            headers: {
              'referer': `https://www.terragonlabs.com/task/${threadId}`
            }
          }
        );

        this.processResponse(response.data, threadId, onMessage);
      } catch (error) {
        console.error(chalk.red('Polling error:'), error);
        if (onError) {
          onError(error as Error);
        }
      }
    };

    // Initial poll
    await pollMessages();

    // Set up interval
    const intervalId = setInterval(pollMessages, this.pollingInterval);
    this.activeListeners.set(threadId, intervalId);
  }

  stopListening(threadId: string): void {
    const intervalId = this.activeListeners.get(threadId);
    if (intervalId) {
      clearInterval(intervalId);
      this.activeListeners.delete(threadId);
      console.log(chalk.yellow(`✓ Stopped listening to thread ${threadId}`));
    }
  }

  stopAllListeners(): void {
    for (const [threadId, intervalId] of this.activeListeners) {
      clearInterval(intervalId);
      console.log(chalk.yellow(`✓ Stopped listening to thread ${threadId}`));
    }
    this.activeListeners.clear();
  }

  private processResponse(responseData: any, threadId: string, onMessage: (message: any) => void): void {
    try {
      const responseText = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
      const messageMatches = responseText.matchAll(/"text":"([^"]+)"/g);
      
      for (const match of messageMatches) {
        const messageText = match[1];
        const messageId = `${threadId}-${messageText.substring(0, 20)}`;
        
        if (!this.processedMessageIds.has(messageId)) {
          this.processedMessageIds.add(messageId);
          
          const message = {
            id: messageId,
            threadId,
            text: messageText,
            timestamp: new Date().toISOString(),
            type: 'assistant'
          };

          console.log(chalk.cyan(`[Chat] New message: ${message.text}`));
          onMessage(message);
        }
      }
    } catch (error) {
      console.error(chalk.red('Error processing response:'), error);
    }
  }

  // Utility to create a chat-specific thread
  async createChatThread(sessionName: string = 'Chat Session'): Promise<string> {
    const threadId = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.log(chalk.green(`✓ Created chat thread: ${threadId}`));
    return threadId;
  }
}