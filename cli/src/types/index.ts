export interface Task {
  id: string;
  name: string;
  description: string;
  objective: string;
  acceptanceCriteria: AcceptanceCriterion[];
  checkpoints: Checkpoint[];
  status: 'pending' | 'in_progress' | 'awaiting_review' | 'complete';
  createdAt: string;
  updatedAt: string;
  terragonSessionId?: string;
}

export interface AcceptanceCriterion {
  id: string;
  description: string;
  passed: boolean;
}

export interface Checkpoint {
  id: string;
  taskId: string;
  name: string;
  objective: string;
  instructions: string[];
  passCriteria: PassCriterion[];
  status: 'pending' | 'in_progress' | 'pass' | 'fail';
  retryCount: number;
  maxRetries: number;
  blocking: boolean;
  parallelizable: boolean;
  logs: LogEntry[];
}

export interface PassCriterion {
  id: string;
  description: string;
  testCommand?: string;
  passed: boolean;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

export interface ProjectDraft {
  id: string;
  content: string;
  validated: boolean;
  validationErrors: ValidationError[];
  createdAt: string;
  updatedAt: string;
}

export interface ValidationError {
  type: 'ux' | 'technical' | 'logic';
  message: string;
  line?: number;
  suggestion?: string;
}

export type RequestType = 'ACTION' | 'INFO' | 'PLANNING' | 'STATUS' | 'GENERAL';

export interface ClassificationResult {
  type: RequestType;
  confidence: number;
  reasoning: string;
}