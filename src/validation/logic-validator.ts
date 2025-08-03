import chalk from 'chalk';

export interface LogicContradiction {
  type: 'dependency' | 'state' | 'flow' | 'constraint' | 'reference';
  description: string;
  conflictingElements: string[];
  suggestion?: string;
  severity: 'error' | 'warning';
}

export class LogicValidator {
  private contradictionPatterns = [
    {
      pattern: /must\s+be\s+(\w+).*must\s+not\s+be\s+\1/gi,
      type: 'state' as const,
      description: 'Conflicting state requirements'
    },
    {
      pattern: /depends\s+on\s+(\w+).*\1\s+depends\s+on/gi,
      type: 'dependency' as const,
      description: 'Circular dependency detected'
    },
    {
      pattern: /before\s+(\w+).*after\s+\1/gi,
      type: 'flow' as const,
      description: 'Temporal flow contradiction'
    },
    {
      pattern: /maximum\s+(\d+).*minimum\s+(\d+)/gi,
      type: 'constraint' as const,
      description: 'Min/max constraint conflict',
      customCheck: (matches: RegExpMatchArray) => {
        const max = parseInt(matches[1]);
        const min = parseInt(matches[2]);
        return min > max;
      }
    }
  ];

  detectContradictions(content: string): LogicContradiction[] {
    const contradictions: LogicContradiction[] = [];
    const lines = content.split('\n');
    
    // Check for pattern-based contradictions
    this.contradictionPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern.pattern);
      for (const match of matches) {
        if (pattern.customCheck && !pattern.customCheck(match)) {
          continue;
        }
        
        contradictions.push({
          type: pattern.type,
          description: pattern.description,
          conflictingElements: [match[0]],
          severity: 'error'
        });
      }
    });
    
    // Check for workflow contradictions
    const workflowContradictions = this.checkWorkflowContradictions(content);
    contradictions.push(...workflowContradictions);
    
    // Check for reference contradictions
    const referenceContradictions = this.checkReferenceContradictions(content);
    contradictions.push(...referenceContradictions);
    
    // Check for state conflicts
    const stateContradictions = this.checkStateContradictions(content);
    contradictions.push(...stateContradictions);
    
    return contradictions;
  }

  private checkWorkflowContradictions(content: string): LogicContradiction[] {
    const contradictions: LogicContradiction[] = [];
    
    // Check if bypass is allowed somewhere but prohibited elsewhere
    const bypassAllowed = /allow.*bypass|bypass.*allowed/i.test(content);
    const bypassProhibited = /never.*bypass|no.*bypass|bypass.*prohibited/i.test(content);
    
    if (bypassAllowed && bypassProhibited) {
      contradictions.push({
        type: 'flow',
        description: 'Conflicting bypass rules detected',
        conflictingElements: ['bypass allowed', 'bypass prohibited'],
        severity: 'error',
        suggestion: 'According to Claude.md, bypassing is never allowed'
      });
    }
    
    // Check for conflicting flow definitions
    const flowPattern1 = /Draft\s*→\s*Validation\s*→\s*Task\s*→\s*Checkpoint\s*→\s*Review/;
    const flowPattern2 = /Draft\s*→\s*Task\s*→\s*Validation/;
    
    if (flowPattern1.test(content) && flowPattern2.test(content)) {
      contradictions.push({
        type: 'flow',
        description: 'Multiple conflicting flow definitions found',
        conflictingElements: ['Draft→Validation→Task', 'Draft→Task→Validation'],
        severity: 'error',
        suggestion: 'Use the canonical flow: Draft → Validation → Task → Checkpoint → Review'
      });
    }
    
    return contradictions;
  }

  private checkReferenceContradictions(content: string): LogicContradiction[] {
    const contradictions: LogicContradiction[] = [];
    
    // Check for non-existent document references
    const docReferences = content.matchAll(/refers?\s+to\s+(\w+\.md)/gi);
    const validDocs = ['Claude.md', 'Project.md', 'Interface.md', 'Technical.md'];
    
    for (const match of docReferences) {
      const referencedDoc = match[1];
      if (!validDocs.includes(referencedDoc)) {
        contradictions.push({
          type: 'reference',
          description: `Reference to non-existent document: ${referencedDoc}`,
          conflictingElements: [referencedDoc],
          severity: 'warning',
          suggestion: `Valid documents are: ${validDocs.join(', ')}`
        });
      }
    }
    
    // Check for conflicting agent references
    const agentReferences = new Set<string>();
    const agentMatches = content.matchAll(/(\w+-\w+)\s+agent/gi);
    
    for (const match of agentMatches) {
      agentReferences.add(match[1].toLowerCase());
    }
    
    // Check if same agent has conflicting responsibilities
    const agentResponsibilities = new Map<string, string[]>();
    const responsibilityPattern = /(\w+-\w+)\s+(?:agent\s+)?(?:handles?|responsible\s+for|manages?)\s+(.+?)(?:\.|,|;)/gi;
    
    const respMatches = content.matchAll(responsibilityPattern);
    for (const match of respMatches) {
      const agent = match[1].toLowerCase();
      const responsibility = match[2].trim();
      
      if (!agentResponsibilities.has(agent)) {
        agentResponsibilities.set(agent, []);
      }
      agentResponsibilities.get(agent)!.push(responsibility);
    }
    
    // Check for conflicting responsibilities
    agentResponsibilities.forEach((responsibilities, agent) => {
      if (responsibilities.length > 1) {
        const conflicts = this.findConflictingResponsibilities(responsibilities);
        if (conflicts.length > 0) {
          contradictions.push({
            type: 'reference',
            description: `Agent ${agent} has conflicting responsibilities`,
            conflictingElements: conflicts,
            severity: 'warning'
          });
        }
      }
    });
    
    return contradictions;
  }

  private checkStateContradictions(content: string): LogicContradiction[] {
    const contradictions: LogicContradiction[] = [];
    
    // Check for conflicting status definitions
    const statusDefinitions = new Map<string, Set<string>>();
    const statusPattern = /(\w+)\s+status\s+(?:can\s+be|includes?|is)\s*:?\s*([^.]+)/gi;
    
    const statusMatches = content.matchAll(statusPattern);
    for (const match of statusMatches) {
      const entity = match[1].toLowerCase();
      const statuses = match[2].split(/[,;]/).map(s => s.trim());
      
      if (!statusDefinitions.has(entity)) {
        statusDefinitions.set(entity, new Set());
      }
      
      statuses.forEach(status => {
        statusDefinitions.get(entity)!.add(status);
      });
    }
    
    // Check for mutually exclusive states
    const mutuallyExclusive = [
      ['pending', 'complete'],
      ['pass', 'fail'],
      ['active', 'inactive'],
      ['enabled', 'disabled']
    ];
    
    statusDefinitions.forEach((statuses, entity) => {
      mutuallyExclusive.forEach(([state1, state2]) => {
        if (statuses.has(state1) && statuses.has(state2)) {
          // Check if they're in the same context
          const regex = new RegExp(`${entity}.*${state1}.*${state2}|${entity}.*${state2}.*${state1}`, 'i');
          if (regex.test(content)) {
            contradictions.push({
              type: 'state',
              description: `${entity} cannot be both ${state1} and ${state2}`,
              conflictingElements: [state1, state2],
              severity: 'error'
            });
          }
        }
      });
    });
    
    return contradictions;
  }

  private findConflictingResponsibilities(responsibilities: string[]): string[] {
    const conflicts: string[] = [];
    const opposites = [
      ['create', 'delete'],
      ['start', 'stop'],
      ['allow', 'prevent'],
      ['enable', 'disable']
    ];
    
    for (let i = 0; i < responsibilities.length; i++) {
      for (let j = i + 1; j < responsibilities.length; j++) {
        const resp1 = responsibilities[i].toLowerCase();
        const resp2 = responsibilities[j].toLowerCase();
        
        opposites.forEach(([word1, word2]) => {
          if ((resp1.includes(word1) && resp2.includes(word2)) ||
              (resp1.includes(word2) && resp2.includes(word1))) {
            conflicts.push(`"${responsibilities[i]}" conflicts with "${responsibilities[j]}"`);
          }
        });
      }
    }
    
    return conflicts;
  }

  validateLogicalCoherence(content: string): { valid: boolean; contradictions: LogicContradiction[] } {
    const contradictions = this.detectContradictions(content);
    
    // Uncle Frank says: No contradictions allowed, period.
    const valid = contradictions.filter(c => c.severity === 'error').length === 0;
    
    if (!valid) {
      console.log(chalk.red('Uncle Frank says: "Fix these contradictions or get outta here!"'));
    }
    
    return { valid, contradictions };
  }
}