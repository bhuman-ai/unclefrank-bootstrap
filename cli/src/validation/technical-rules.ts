import { readFile } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';

export interface TechnicalConstraint {
  constraintType: 'performance' | 'architecture' | 'technology' | 'security' | 'scalability' | 'development';
  category: string;
  metric: string;
  minValue?: number;
  maxValue?: number;
  requirement?: string;
  unit?: string;
  lineNumber?: number;
}

export class TechnicalRules {
  private constraints: TechnicalConstraint[] = [];
  private technicalMdPath: string;

  constructor(private workingDir: string) {
    this.technicalMdPath = join(workingDir, 'Technical.md');
  }

  async parseConstraints(): Promise<void> {
    try {
      const content = await readFile(this.technicalMdPath, 'utf-8');
      const lines = content.split('\n');
      
      let currentSection = '';
      let currentType: TechnicalConstraint['constraintType'] = 'performance';
      
      lines.forEach((line, index) => {
        // Section headers
        if (line.startsWith('## ')) {
          currentSection = line.replace('## ', '').trim();
          
          // Map sections to constraint types
          if (currentSection.includes('Performance')) currentType = 'performance';
          else if (currentSection.includes('Architecture')) currentType = 'architecture';
          else if (currentSection.includes('Technology')) currentType = 'technology';
          else if (currentSection.includes('Security')) currentType = 'security';
          else if (currentSection.includes('Scalability')) currentType = 'scalability';
          else if (currentSection.includes('Development')) currentType = 'development';
        }
        
        // Parse constraints with numeric values
        const numericMatch = line.match(/- \*\*(.+?)\*\*:\s*(.+?)(\d+(?:\.\d+)?)\s*(\w+)?/);
        if (numericMatch) {
          const [, metric, prefix, value, unit] = numericMatch;
          const isMax = prefix.toLowerCase().includes('maximum') || prefix.toLowerCase().includes('must not exceed');
          const isMin = prefix.toLowerCase().includes('minimum') || prefix.toLowerCase().includes('at least');
          
          this.constraints.push({
            constraintType: currentType,
            category: currentSection,
            metric: metric.trim(),
            maxValue: isMax ? parseFloat(value) : undefined,
            minValue: isMin ? parseFloat(value) : undefined,
            unit: unit?.trim(),
            requirement: line.replace(/^-\s*/, '').replace(/\*\*/g, '').trim(),
            lineNumber: index + 1
          });
        }
        
        // Parse non-numeric requirements
        else if (line.includes('- **') && line.includes('**')) {
          const match = line.match(/- \*\*(.+?)\*\*:\s*(.+)/);
          if (match) {
            const [, metric, requirement] = match;
            this.constraints.push({
              constraintType: currentType,
              category: currentSection,
              metric: metric.trim(),
              requirement: requirement.trim(),
              lineNumber: index + 1
            });
          }
        }
      });
      
      console.log(chalk.green(`✓ Parsed ${this.constraints.length} technical constraints from Technical.md`));
    } catch (error) {
      console.error(chalk.red('Failed to parse Technical.md:'), error);
      throw error;
    }
  }

  validatePerformance(content: string): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    const perfConstraints = this.constraints.filter(c => c.constraintType === 'performance');
    
    // Check for performance-related keywords that might violate constraints
    perfConstraints.forEach(constraint => {
      if (constraint.metric.includes('Page Load Time') && constraint.maxValue) {
        if (content.includes('heavy') || content.includes('large bundle')) {
          violations.push(`Potential violation of ${constraint.metric}: ${constraint.requirement}`);
        }
      }
      
      if (constraint.metric.includes('API Response Time') && constraint.maxValue) {
        if (content.includes('synchronous') && content.includes('multiple')) {
          violations.push(`Multiple synchronous calls may violate ${constraint.metric} limit of ${constraint.maxValue}ms`);
        }
      }
    });
    
    return { valid: violations.length === 0, violations };
  }

  validateArchitecture(content: string): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    const archConstraints = this.constraints.filter(c => c.constraintType === 'architecture');
    
    archConstraints.forEach(constraint => {
      // Check RESTful API requirement
      if (constraint.metric.includes('API Design') && constraint.requirement?.includes('RESTful')) {
        if (content.includes('graphql') || content.includes('soap')) {
          violations.push(`Violation: ${constraint.metric} requires RESTful endpoints`);
        }
      }
      
      // Check error handling requirement
      if (constraint.metric.includes('Error Handling')) {
        if (!content.includes('try') && !content.includes('catch') && !content.includes('error')) {
          violations.push(`Missing error handling: ${constraint.requirement}`);
        }
      }
    });
    
    return { valid: violations.length === 0, violations };
  }

  validateSecurity(content: string): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    const secConstraints = this.constraints.filter(c => c.constraintType === 'security');
    
    secConstraints.forEach(constraint => {
      // Check for input validation
      if (constraint.metric.includes('Input Validation')) {
        if (content.includes('innerHTML') || content.includes('eval(')) {
          violations.push(`Security violation: ${constraint.metric} - unsafe operations detected`);
        }
      }
      
      // Check for SQL injection prevention
      if (constraint.metric.includes('SQL Injection')) {
        if (content.includes('query(') && !content.includes('parameterized')) {
          violations.push(`Security risk: ${constraint.metric} - use parameterized queries`);
        }
      }
    });
    
    return { valid: violations.length === 0, violations };
  }

  validateScalability(content: string): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    const scaleConstraints = this.constraints.filter(c => c.constraintType === 'scalability');
    
    scaleConstraints.forEach(constraint => {
      // Check file upload limits
      if (constraint.metric.includes('File Upload') && constraint.maxValue) {
        const uploadMatch = content.match(/maxFileSize[:\s]*(\d+)/);
        if (uploadMatch && parseInt(uploadMatch[1]) > constraint.maxValue * 1024 * 1024) {
          violations.push(`File upload size exceeds ${constraint.maxValue}MB limit`);
        }
      }
      
      // Check concurrent user support
      if (constraint.metric.includes('Concurrent Users') && constraint.minValue) {
        if (content.includes('singleton') || content.includes('global state')) {
          violations.push(`Design may not support ${constraint.minValue} concurrent users`);
        }
      }
    });
    
    return { valid: violations.length === 0, violations };
  }

  checkConstraint(metric: string, value: number): boolean {
    const constraint = this.constraints.find(c => c.metric === metric);
    if (!constraint) return true;
    
    if (constraint.maxValue !== undefined && value > constraint.maxValue) {
      return false;
    }
    
    if (constraint.minValue !== undefined && value < constraint.minValue) {
      return false;
    }
    
    return true;
  }

  validateAll(content: string): { valid: boolean; violations: string[] } {
    const perfValidation = this.validatePerformance(content);
    const archValidation = this.validateArchitecture(content);
    const secValidation = this.validateSecurity(content);
    const scaleValidation = this.validateScalability(content);
    
    const allViolations = [
      ...perfValidation.violations,
      ...archValidation.violations,
      ...secValidation.violations,
      ...scaleValidation.violations
    ];
    
    return {
      valid: allViolations.length === 0,
      violations: allViolations
    };
  }

  getConstraints(): TechnicalConstraint[] {
    return this.constraints;
  }
}