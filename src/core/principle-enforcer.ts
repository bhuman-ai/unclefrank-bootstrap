import { readFile } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';

export class PrincipleEnforcer {
  private claudeMdPath: string;
  private principles: string[] = [];

  constructor(private workingDir: string) {
    this.claudeMdPath = join(workingDir, 'CLAUDE.md');
  }

  async loadPrinciples(): Promise<void> {
    try {
      const content = await readFile(this.claudeMdPath, 'utf-8');
      
      // Extract core principles
      const principlesMatch = content.match(/## Core Principles[\s\S]*?(?=##|$)/);
      if (!principlesMatch) {
        throw new Error('No Core Principles section found in CLAUDE.md');
      }

      this.principles = principlesMatch[0]
        .split('\n')
        .filter(line => line.includes('**') && line.includes(':'))
        .map(line => {
          const match = line.match(/\*\*(.+?)\*\*/);
          return match ? match[1] : '';
        })
        .filter(Boolean);

      console.log(chalk.green(`✓ Loaded ${this.principles.length} sacred principles`));
    } catch (error) {
      console.error(chalk.red('Failed to load CLAUDE.md:'), error);
      throw error;
    }
  }

  async validateAction(action: string, context?: any): Promise<{
    allowed: boolean;
    violations: string[];
    reasoning: string;
  }> {
    const violations: string[] = [];

    // Check for bypassing the flow
    if (action.toLowerCase().includes('bypass') || action.toLowerCase().includes('skip')) {
      violations.push('No Bypassing - all changes must follow the sacred flow');
    }

    // Check for direct merges without review
    if (action.includes('merge') && !context?.humanApproved) {
      violations.push('Human confirmation is mandatory before any merge');
    }

    // Check for template usage (we want AI-driven, not templates)
    if (action.includes('template') || action.includes('boilerplate')) {
      violations.push('AI-driven task decomposition required - no templates');
    }

    return {
      allowed: violations.length === 0,
      violations,
      reasoning: violations.length > 0 
        ? `Uncle Frank says: "${violations.join('. ')}". Cut the crap and follow the rules.`
        : 'Action follows sacred principles'
    };
  }

  async enforceDocumentHierarchy(documentType: string): boolean {
    const hierarchy = ['CLAUDE.md', 'Project.md', 'Interface.md', 'Technical.md'];
    return hierarchy.includes(documentType);
  }

  getPrinciples(): string[] {
    return this.principles;
  }
}