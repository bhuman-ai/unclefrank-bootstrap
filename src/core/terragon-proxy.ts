import axios from 'axios';
import chalk from 'chalk';
import type { Checkpoint } from '../types';

export class TerragonProxy {
  private baseUrl = 'https://terragon.bhuman.ai/api';
  private authToken: string;

  constructor(authToken: string) {
    this.authToken = authToken;
  }

  async createSession(taskName: string): Promise<string> {
    try {
      console.log(chalk.blue('Creating Terragon session...'));
      
      const response = await axios.post(
        `${this.baseUrl}/sessions`,
        {
          name: taskName,
          type: 'task_execution',
          metadata: {
            platform: 'unclefrank-bootstrap',
            version: '0.0.1'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const sessionId = response.data.session_id || response.data.id;
      console.log(chalk.green(`✓ Session created: ${sessionId}`));
      return sessionId;
    } catch (error) {
      console.error(chalk.red('Failed to create Terragon session:'), error);
      if (axios.isAxiosError(error)) {
        console.error('Response:', error.response?.data);
      }
      throw error;
    }
  }

  async sendMessage(
    sessionId: string,
    message: string,
    context?: any
  ): Promise<any> {
    try {
      console.log(chalk.blue('Sending message to Terragon...'));
      
      const response = await axios.post(
        `${this.baseUrl}/sessions/${sessionId}/messages`,
        {
          message,
          context: {
            ...context,
            timestamp: new Date().toISOString()
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
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
    sessionId: string,
    checkpoint: Checkpoint,
    projectContext: string
  ): Promise<string> {
    const message = this.buildCheckpointMessage(checkpoint, projectContext);
    
    console.log(chalk.cyan(`\nExecuting checkpoint: ${checkpoint.name}`));
    console.log(chalk.gray('Objective:'), checkpoint.objective);
    
    const response = await this.sendMessage(sessionId, message, {
      checkpointId: checkpoint.id,
      checkpointName: checkpoint.name,
      step: 'execution'
    });

    // Extract the actual response text from Terragon
    const responseText = response.message || response.content || JSON.stringify(response);
    
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

  async getSessionHistory(sessionId: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/sessions/${sessionId}/messages`,
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        }
      );

      return response.data.messages || response.data || [];
    } catch (error) {
      console.error(chalk.red('Failed to get session history:'), error);
      return [];
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    try {
      await axios.post(
        `${this.baseUrl}/sessions/${sessionId}/close`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        }
      );
      console.log(chalk.green('✓ Session closed'));
    } catch (error) {
      console.warn(chalk.yellow('Failed to close session:'), error);
    }
  }
}