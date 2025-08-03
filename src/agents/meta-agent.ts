import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import type { RequestType, ClassificationResult, Task, Checkpoint } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class MetaAgent {
  private claude: Anthropic;

  constructor(apiKey: string) {
    this.claude = new Anthropic({ apiKey });
  }

  async classifyRequest(message: string): Promise<ClassificationResult> {
    const patterns = {
      ACTION: [
        /\b(implement|create|build|add|fix|refactor|update)\b/i,
        /\b(set up|setup|integrate|deploy)\b/i
      ],
      INFO: [
        /^(what|how|why|when|where|who|explain|tell me|describe)\b/i,
        /\b(does|is|are|can|could|should)\s+\w+\?$/i
      ],
      PLANNING: [
        /\b(plan|design|architect|structure|organize|think about)\b/i,
        /\b(approach|strategy|best way)\b/i
      ],
      STATUS: [
        /\b(status|progress|update|how's|where are we)\b/i,
        /\b(going|doing|complete|done)\b/i
      ]
    };

    const lower = message.toLowerCase();
    for (const [type, typePatterns] of Object.entries(patterns)) {
      for (const pattern of typePatterns) {
        if (pattern.test(lower)) {
          return {
            type: type as RequestType,
            confidence: 0.8,
            reasoning: `Matched pattern for ${type}`
          };
        }
      }
    }

    return {
      type: 'GENERAL',
      confidence: 0.5,
      reasoning: 'No specific pattern matched'
    };
  }

  async decomposeTask(
    request: string,
    projectContext: string
  ): Promise<{ task: Task; checkpoints: Checkpoint[] }> {
    const prompt = `You are Uncle Frank, a no-nonsense guy from Brooklyn who breaks down complex tasks into micro-actions.

PROJECT CONTEXT:
${projectContext}

USER REQUEST:
${request}

DECOMPOSITION RULES:
1. Each checkpoint must take ≤10 minutes to complete
2. Binary pass/fail criteria only - no ambiguity
3. Be specific about implementation details
4. Include validation checkpoints
5. No fluff, no corporate BS - just actionable steps

FORMAT YOUR RESPONSE AS JSON:
{
  "task": {
    "name": "Short, clear task name",
    "objective": "What we're actually doing",
    "acceptanceCriteria": [
      {"description": "Binary test that proves it works"}
    ]
  },
  "checkpoints": [
    {
      "name": "Specific action",
      "objective": "Clear micro-goal",
      "instructions": ["Step 1", "Step 2"],
      "passCriteria": [
        {"description": "Binary test", "testCommand": "optional test command"}
      ],
      "blocking": true/false,
      "parallelizable": true/false
    }
  ]
}`;

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Add IDs and metadata
      const task: Task = {
        ...parsed.task,
        id: `task-${uuidv4()}`,
        description: request,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        acceptanceCriteria: parsed.task.acceptanceCriteria.map((ac: any) => ({
          ...ac,
          id: uuidv4(),
          passed: false
        })),
        checkpoints: []
      };

      const checkpoints: Checkpoint[] = parsed.checkpoints.map((cp: any) => ({
        ...cp,
        id: `checkpoint-${uuidv4()}`,
        taskId: task.id,
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        logs: [],
        passCriteria: cp.passCriteria.map((pc: any) => ({
          ...pc,
          id: uuidv4(),
          passed: false
        }))
      }));

      task.checkpoints = checkpoints;

      console.log(chalk.green(`✓ Decomposed into ${checkpoints.length} checkpoints`));
      return { task, checkpoints };
    } catch (error) {
      console.error(chalk.red('Decomposition failed:'), error);
      throw error;
    }
  }

  async analyzeForContinuation(
    checkpoint: Checkpoint,
    terragonResponse: string
  ): Promise<{
    canContinue: boolean;
    needsUserInput: boolean;
    isComplete: boolean;
    nextAction?: string;
    question?: string;
    reasoning: string;
  }> {
    const prompt = `You are Uncle Frank analyzing a checkpoint execution response.

CHECKPOINT: ${checkpoint.name}
OBJECTIVE: ${checkpoint.objective}
PASS CRITERIA: ${checkpoint.passCriteria.map(pc => pc.description).join(', ')}

TERRAGON RESPONSE:
${terragonResponse}

Determine if:
1. The checkpoint can continue autonomously
2. User input is genuinely needed (not just clarification)
3. The checkpoint appears complete
4. There's an error needing intervention

Be direct. No BS. If it can be figured out, figure it out.

Return JSON:
{
  "canContinue": boolean,
  "needsUserInput": boolean,
  "isComplete": boolean,
  "nextAction": "specific action if canContinue=true",
  "question": "specific question if needsUserInput=true",
  "reasoning": "Uncle Frank's take on the situation"
}`;

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : {
        needsUserInput: true,
        canContinue: false,
        isComplete: false,
        question: 'Unable to analyze response automatically',
        reasoning: 'Failed to parse Terragon response'
      };
    } catch (error) {
      console.error(chalk.red('Analysis failed:'), error);
      return {
        needsUserInput: true,
        canContinue: false,
        isComplete: false,
        question: 'Error analyzing response',
        reasoning: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}