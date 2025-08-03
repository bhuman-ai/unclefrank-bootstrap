import { readFile } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';

export interface UIRule {
  ruleType: 'layout' | 'screen' | 'interaction' | 'feedback' | 'linking';
  category: string;
  condition: string;
  requirement: string;
  lineNumber?: number;
}

export class InterfaceRules {
  private rules: UIRule[] = [];
  private interfaceMdPath: string;

  constructor(private workingDir: string) {
    this.interfaceMdPath = join(workingDir, 'Interface.md');
  }

  async parseRules(): Promise<void> {
    try {
      const content = await readFile(this.interfaceMdPath, 'utf-8');
      const lines = content.split('\n');
      
      let currentSection = '';
      let currentRuleType: UIRule['ruleType'] = 'layout';
      
      lines.forEach((line, index) => {
        // Section headers
        if (line.startsWith('## ')) {
          currentSection = line.replace('## ', '').trim();
          
          // Map sections to rule types
          if (currentSection.includes('Layout')) currentRuleType = 'layout';
          else if (currentSection.includes('Screen')) currentRuleType = 'screen';
          else if (currentSection.includes('Interaction')) currentRuleType = 'interaction';
          else if (currentSection.includes('Alerts') || currentSection.includes('Feedback')) currentRuleType = 'feedback';
          else if (currentSection.includes('Linking')) currentRuleType = 'linking';
        }
        
        // Parse bullet points with requirements
        if (line.includes('- **') && line.includes('**')) {
          const match = line.match(/- \*\*(.+?)\*\*(.+)/);
          if (match) {
            const [, condition, requirement] = match;
            this.rules.push({
              ruleType: currentRuleType,
              category: currentSection,
              condition: condition.trim(),
              requirement: requirement.replace(/^[:\s—-]+/, '').trim(),
              lineNumber: index + 1
            });
          }
        }
        
        // Parse numbered items (screens)
        const numberedMatch = line.match(/^\d+\.\s*\*\*(.+?)\*\*\s*—\s*(.+)/);
        if (numberedMatch) {
          const [, condition, requirement] = numberedMatch;
          this.rules.push({
            ruleType: 'screen',
            category: currentSection,
            condition: condition.trim(),
            requirement: requirement.trim(),
            lineNumber: index + 1
          });
        }
      });
      
      console.log(chalk.green(`✓ Parsed ${this.rules.length} UI/UX rules from Interface.md`));
    } catch (error) {
      console.error(chalk.red('Failed to parse Interface.md:'), error);
      throw error;
    }
  }

  validateLayout(content: string): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    const layoutRules = this.rules.filter(r => r.ruleType === 'layout');
    
    layoutRules.forEach(rule => {
      // Check for 3/4 screen document editor requirement
      if (rule.condition.includes('3/4 Screen Document Editor')) {
        if (!content.includes('editor') || !content.includes('document')) {
          violations.push(`Missing ${rule.condition}: ${rule.requirement}`);
        }
      }
      
      // Check for 1/4 screen chat sidebar
      if (rule.condition.includes('1/4 Screen Persistent Chat Sidebar')) {
        if (!content.includes('chat') && !content.includes('sidebar')) {
          violations.push(`Missing ${rule.condition}: ${rule.requirement}`);
        }
      }
    });
    
    return { valid: violations.length === 0, violations };
  }

  validateScreenStructure(content: string): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    const screenRules = this.rules.filter(r => r.ruleType === 'screen');
    
    // Check if all required screens are referenced
    const requiredScreens = [
      'Project Dashboard',
      'Project Workspace View', 
      'Task Queue',
      'Validation Dashboard',
      'Merge Review Screen'
    ];
    
    requiredScreens.forEach(screen => {
      const rule = screenRules.find(r => r.condition.includes(screen));
      if (rule && !content.includes(screen.toLowerCase().replace(/\s+/g, '_'))) {
        violations.push(`Missing required screen: ${screen}`);
      }
    });
    
    return { valid: violations.length === 0, violations };
  }

  validateInteractionFlow(content: string): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    const interactionRules = this.rules.filter(r => r.ruleType === 'interaction');
    
    // Check for immutable flow enforcement
    const flowPattern = /Draft\s*→\s*Validation\s*→\s*Task\s*→\s*Checkpoint\s*→\s*Review/i;
    if (!content.match(flowPattern)) {
      violations.push('Must enforce immutable Draft → Validation → Task → Checkpoint → Review flow');
    }
    
    // Check for bypass prevention
    if (content.includes('bypass') || content.includes('skip')) {
      violations.push('Users can never bypass the flow - found bypass/skip references');
    }
    
    return { valid: violations.length === 0, violations };
  }

  validateAll(content: string): { valid: boolean; violations: string[] } {
    const layoutValidation = this.validateLayout(content);
    const screenValidation = this.validateScreenStructure(content);
    const interactionValidation = this.validateInteractionFlow(content);
    
    const allViolations = [
      ...layoutValidation.violations,
      ...screenValidation.violations,
      ...interactionValidation.violations
    ];
    
    return {
      valid: allViolations.length === 0,
      violations: allViolations
    };
  }

  getRules(): UIRule[] {
    return this.rules;
  }
}