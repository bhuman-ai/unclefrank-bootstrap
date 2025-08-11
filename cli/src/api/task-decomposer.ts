/**
 * Task Decomposer API
 * Breaks down high-level tasks into executable checkpoints following Uncle Frank's methodology
 */

export interface Checkpoint {
  id: string;
  name: string;
  description: string;
  passFail: string;
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface DecomposedTask {
  originalRequest: string;
  summary: string;
  checkpoints: Checkpoint[];
  estimatedTime: string;
  complexity: 'simple' | 'moderate' | 'complex';
}

export class TaskDecomposer {
  /**
   * Decompose a high-level task into executable checkpoints
   * Following Uncle Frank's micro-execution philosophy
   */
  async decomposeTask(request: string, context?: string): Promise<DecomposedTask> {
    // Frank's approach: Break it down to the smallest executable units
    const checkpoints = this.analyzeAndDecompose(request, context);
    
    return {
      originalRequest: request,
      summary: this.generateSummary(request),
      checkpoints,
      estimatedTime: this.estimateTime(checkpoints),
      complexity: this.assessComplexity(checkpoints)
    };
  }

  private analyzeAndDecompose(request: string, context?: string): Checkpoint[] {
    // Parse the request to identify key components
    const keywords = this.extractKeywords(request);
    const isUITask = keywords.some(k => ['ui', 'interface', 'view', 'page', 'component'].includes(k.toLowerCase()));
    const isAPITask = keywords.some(k => ['api', 'endpoint', 'route', 'backend'].includes(k.toLowerCase()));
    const isDataTask = keywords.some(k => ['database', 'model', 'schema', 'data'].includes(k.toLowerCase()));
    
    const checkpoints: Checkpoint[] = [];
    let checkpointId = 1;

    // Frank's methodology: Start with setup/foundation
    if (isDataTask || isAPITask) {
      checkpoints.push({
        id: `CP${checkpointId++}`,
        name: 'Define Data Models',
        description: 'Create TypeScript interfaces and database schemas for all entities',
        passFail: 'All models have proper types and schemas are migration-ready',
        dependencies: [],
        status: 'pending'
      });
    }

    if (isAPITask) {
      checkpoints.push({
        id: `CP${checkpointId++}`,
        name: 'Create API Endpoints',
        description: 'Implement REST endpoints with proper HTTP methods and status codes',
        passFail: 'All endpoints respond correctly with proper error handling',
        dependencies: isDataTask ? ['CP1'] : [],
        status: 'pending'
      });

      checkpoints.push({
        id: `CP${checkpointId++}`,
        name: 'Add API Validation',
        description: 'Implement request validation and sanitization',
        passFail: 'Invalid requests return appropriate error messages',
        dependencies: [`CP${checkpointId-1}`],
        status: 'pending'
      });
    }

    if (isUITask) {
      checkpoints.push({
        id: `CP${checkpointId++}`,
        name: 'Create UI Components',
        description: 'Build React components with proper state management',
        passFail: 'Components render without errors and handle all states',
        dependencies: isAPITask ? [`CP2`] : [],
        status: 'pending'
      });

      checkpoints.push({
        id: `CP${checkpointId++}`,
        name: 'Connect UI to Backend',
        description: 'Integrate API calls and handle loading/error states',
        passFail: 'UI correctly displays data and handles all API responses',
        dependencies: [`CP${checkpointId-1}`],
        status: 'pending'
      });

      checkpoints.push({
        id: `CP${checkpointId++}`,
        name: 'Add User Interactions',
        description: 'Implement form submissions, validations, and user feedback',
        passFail: 'All user actions work correctly with proper feedback',
        dependencies: [`CP${checkpointId-1}`],
        status: 'pending'
      });
    }

    // Always add testing as final checkpoint - Frank's rule
    checkpoints.push({
      id: `CP${checkpointId++}`,
      name: 'Test & Verify',
      description: 'Run all tests and verify the implementation works end-to-end',
      passFail: 'All tests pass and manual verification confirms functionality',
      dependencies: checkpoints.length > 0 ? [`CP${checkpointId-1}`] : [],
      status: 'pending'
    });

    // If no specific checkpoints were added, create generic ones
    if (checkpoints.length === 1) {
      const genericCheckpoints = this.createGenericCheckpoints(request);
      checkpoints.unshift(...genericCheckpoints);
    }

    return checkpoints;
  }

  private createGenericCheckpoints(request: string): Checkpoint[] {
    // Frank's generic breakdown for any task
    return [
      {
        id: 'CP1',
        name: 'Analyze Requirements',
        description: 'Understand the task requirements and identify necessary components',
        passFail: 'Clear understanding of what needs to be built',
        dependencies: [],
        status: 'pending'
      },
      {
        id: 'CP2',
        name: 'Implement Core Logic',
        description: 'Build the main functionality requested',
        passFail: 'Core feature works as specified',
        dependencies: ['CP1'],
        status: 'pending'
      },
      {
        id: 'CP3',
        name: 'Handle Edge Cases',
        description: 'Add error handling and edge case management',
        passFail: 'System handles errors gracefully',
        dependencies: ['CP2'],
        status: 'pending'
      }
    ];
  }

  private extractKeywords(request: string): string[] {
    // Extract meaningful keywords for task analysis
    const words = request.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'that', 'this', 'must', 'should', 'will'];
    return words.filter(w => !stopWords.includes(w) && w.length > 2);
  }

  private generateSummary(request: string): string {
    // Frank's style summary - straight to the point
    const lines = request.split('.').filter(l => l.trim());
    if (lines.length > 0) {
      return lines[0].trim() + (lines[0].endsWith('.') ? '' : '.');
    }
    return request.substring(0, 100) + (request.length > 100 ? '...' : '');
  }

  private estimateTime(checkpoints: Checkpoint[]): string {
    // Frank's time estimates - realistic, not optimistic
    const timePerCheckpoint = 30; // minutes
    const totalMinutes = checkpoints.length * timePerCheckpoint;
    
    if (totalMinutes < 60) {
      return `${totalMinutes} minutes`;
    } else if (totalMinutes < 480) {
      const hours = Math.ceil(totalMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      const days = Math.ceil(totalMinutes / 480);
      return `${days} day${days > 1 ? 's' : ''}`;
    }
  }

  private assessComplexity(checkpoints: Checkpoint[]): 'simple' | 'moderate' | 'complex' {
    if (checkpoints.length <= 3) return 'simple';
    if (checkpoints.length <= 6) return 'moderate';
    return 'complex';
  }

  /**
   * Convert checkpoints to Claude-executable format
   */
  formatForClaude(task: DecomposedTask): string {
    let formatted = `TASK BREAKDOWN:\n\n`;
    formatted += `Original Request: ${task.originalRequest}\n`;
    formatted += `Summary: ${task.summary}\n`;
    formatted += `Complexity: ${task.complexity}\n`;
    formatted += `Estimated Time: ${task.estimatedTime}\n\n`;
    formatted += `CHECKPOINTS TO COMPLETE:\n\n`;

    task.checkpoints.forEach((cp, index) => {
      formatted += `${index + 1}. [${cp.id}] ${cp.name}\n`;
      formatted += `   Description: ${cp.description}\n`;
      formatted += `   Pass/Fail: ${cp.passFail}\n`;
      if (cp.dependencies.length > 0) {
        formatted += `   Dependencies: ${cp.dependencies.join(', ')}\n`;
      }
      formatted += `\n`;
    });

    formatted += `\nExecute these checkpoints in order, verifying each passes before moving to the next.`;
    formatted += `\nIf a checkpoint fails, debug and fix before continuing.`;
    formatted += `\nCreate a GitHub branch for this work and commit after each checkpoint.`;

    return formatted;
  }
}

// Export singleton instance
export const taskDecomposer = new TaskDecomposer();