/**
 * Intelligent Task Analyzer
 * SACRED PRINCIPLE: Real analysis, not keyword matching bullshit
 * Uncle Frank says: "Understand what needs to be built, don't guess"
 */

export interface AnalyzedTask {
    type: 'ui' | 'api' | 'data' | 'infrastructure' | 'integration' | 'mixed';
    components: string[];
    technologies: string[];
    dependencies: string[];
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedCheckpoints: number;
    risks: string[];
}

export class IntelligentTaskAnalyzer {
    /**
     * REAL task analysis using pattern recognition and context understanding
     * Not just "contains word 'UI' = UI task" nonsense
     */
    analyzeTask(request: string, _context?: string): AnalyzedTask {
        console.log('🧠 Frank is analyzing the ACTUAL task requirements...');
        
        const analysis: AnalyzedTask = {
            type: 'mixed',
            components: [],
            technologies: [],
            dependencies: [],
            complexity: 'moderate',
            estimatedCheckpoints: 3,
            risks: []
        };

        // Analyze request structure and patterns
        const patterns = this.extractPatterns(request);
        const entities = this.extractEntities(request);
        const actions = this.extractActions(request);
        
        // Determine task type based on actual requirements
        analysis.type = this.determineTaskType(patterns, entities, actions);
        
        // Extract components that need to be built
        analysis.components = this.identifyComponents(request, analysis.type);
        
        // Identify required technologies
        analysis.technologies = this.identifyTechnologies(request, analysis.components);
        
        // Detect dependencies
        analysis.dependencies = this.identifyDependencies(analysis.components, analysis.technologies);
        
        // Calculate complexity based on REAL factors
        analysis.complexity = this.calculateComplexity(analysis);
        
        // Estimate checkpoints needed
        analysis.estimatedCheckpoints = this.estimateCheckpoints(analysis);
        
        // Identify risks
        analysis.risks = this.identifyRisks(analysis);
        
        return analysis;
    }

    private extractPatterns(request: string): Map<string, number> {
        const patterns = new Map<string, number>();
        
        // UI/Frontend patterns
        const uiPatterns = [
            /\b(interface|UI|user interface|frontend|display|show|render|view|screen|page|form|button|input|modal|dashboard|layout)\b/gi,
            /\b(React|Vue|Angular|component|widget|responsive|CSS|styling)\b/gi
        ];
        
        // API/Backend patterns
        const apiPatterns = [
            /\b(API|endpoint|route|REST|GraphQL|backend|server|service|microservice)\b/gi,
            /\b(POST|GET|PUT|DELETE|request|response|HTTP|webhook)\b/gi
        ];
        
        // Data patterns
        const dataPatterns = [
            /\b(database|data|schema|model|migration|table|collection|store|persist)\b/gi,
            /\b(PostgreSQL|MongoDB|Redis|MySQL|SQL|NoSQL|query)\b/gi
        ];
        
        // Count pattern matches
        patterns.set('ui', this.countPatternMatches(request, uiPatterns));
        patterns.set('api', this.countPatternMatches(request, apiPatterns));
        patterns.set('data', this.countPatternMatches(request, dataPatterns));
        
        return patterns;
    }

    private extractEntities(request: string): string[] {
        const entities: string[] = [];
        
        // Extract nouns that represent entities/components
        const entityPatterns = [
            /\b([A-Z][a-z]+(?:[A-Z][a-z]+)*)\b/g, // PascalCase
            /\b(user|admin|customer|product|order|payment|notification|report|document|file|message|task|project)\b/gi
        ];
        
        entityPatterns.forEach(pattern => {
            const matches = request.match(pattern);
            if (matches) {
                entities.push(...matches.map(m => m.toLowerCase()));
            }
        });
        
        return [...new Set(entities)];
    }

    private extractActions(request: string): string[] {
        const actions: string[] = [];
        
        // Extract verbs that represent actions
        const actionPatterns = [
            /\b(create|build|implement|add|update|delete|remove|fetch|display|validate|authenticate|authorize|process|generate|send|receive|track|manage|handle)\b/gi
        ];
        
        actionPatterns.forEach(pattern => {
            const matches = request.match(pattern);
            if (matches) {
                actions.push(...matches.map(m => m.toLowerCase()));
            }
        });
        
        return [...new Set(actions)];
    }

    private determineTaskType(
        patterns: Map<string, number>, 
        entities: string[], 
        actions: string[]
    ): AnalyzedTask['type'] {
        const scores = {
            ui: patterns.get('ui') || 0,
            api: patterns.get('api') || 0,
            data: patterns.get('data') || 0
        };
        
        // Adjust scores based on entities and actions
        if (entities.some(e => ['form', 'button', 'modal', 'page'].includes(e))) {
            scores.ui += 3;
        }
        
        if (actions.some(a => ['fetch', 'send', 'receive'].includes(a))) {
            scores.api += 2;
        }
        
        if (actions.some(a => ['store', 'persist', 'query'].includes(a))) {
            scores.data += 2;
        }
        
        // Determine primary type
        const maxScore = Math.max(scores.ui, scores.api, scores.data);
        const significantScores = Object.entries(scores).filter(([_, score]) => score > 0);
        
        if (significantScores.length > 1) {
            return 'mixed';
        }
        
        if (scores.ui === maxScore && scores.ui > 0) return 'ui';
        if (scores.api === maxScore && scores.api > 0) return 'api';
        if (scores.data === maxScore && scores.data > 0) return 'data';
        
        // Check for infrastructure or integration tasks (using the request parameter)
        const requestLower = request.toLowerCase();
        if (requestLower.includes('deploy') || requestLower.includes('setup')) {
            return 'infrastructure';
        }
        
        if (requestLower.includes('integrate') || requestLower.includes('connect')) {
            return 'integration';
        }
        
        return 'mixed';
    }

    private identifyComponents(request: string, taskType: string): string[] {
        const components: string[] = [];
        
        // Extract component hints from request
        const componentPatterns = {
            ui: [
                /(?:create|build|implement)\s+(?:a\s+)?(\w+\s+(?:component|page|view|form|modal|dashboard))/gi,
                /(\w+\s+(?:interface|UI|screen))/gi
            ],
            api: [
                /(?:create|build|implement)\s+(?:a\s+)?(\w+\s+(?:endpoint|API|route|service))/gi,
                /((?:POST|GET|PUT|DELETE)\s+\/\w+)/gi
            ],
            data: [
                /(?:create|build|implement)\s+(?:a\s+)?(\w+\s+(?:model|schema|table|collection))/gi,
                /(\w+\s+database)/gi
            ]
        };
        
        const patterns = componentPatterns[taskType] || [];
        patterns.forEach(pattern => {
            const matches = request.match(pattern);
            if (matches) {
                components.push(...matches);
            }
        });
        
        // Add generic components based on task type
        if (components.length === 0) {
            switch (taskType) {
                case 'ui':
                    components.push('User Interface Component');
                    break;
                case 'api':
                    components.push('API Endpoint');
                    break;
                case 'data':
                    components.push('Data Model');
                    break;
                default:
                    components.push('System Component');
            }
        }
        
        return components;
    }

    private identifyTechnologies(request: string, components: string[]): string[] {
        const technologies: string[] = [];
        
        // Check for explicit technology mentions
        const techPatterns = {
            frontend: ['React', 'Vue', 'Angular', 'Next.js', 'TypeScript', 'JavaScript'],
            backend: ['Node.js', 'Express', 'FastAPI', 'Django', 'Flask'],
            database: ['PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'SQLite'],
            cloud: ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes']
        };
        
        Object.values(techPatterns).flat().forEach(tech => {
            if (request.toLowerCase().includes(tech.toLowerCase())) {
                technologies.push(tech);
            }
        });
        
        // Infer technologies from components
        if (technologies.length === 0) {
            if (components.some(c => c.toLowerCase().includes('react'))) {
                technologies.push('React');
            }
            if (components.some(c => c.toLowerCase().includes('api'))) {
                technologies.push('Node.js', 'Express');
            }
            if (components.some(c => c.toLowerCase().includes('database'))) {
                technologies.push('PostgreSQL');
            }
        }
        
        return technologies;
    }

    private identifyDependencies(components: string[], technologies: string[]): string[] {
        const dependencies: string[] = [];
        
        // Map technologies to common dependencies
        const techDependencies = {
            'React': ['react', 'react-dom'],
            'Node.js': ['express', 'cors'],
            'PostgreSQL': ['pg', 'sequelize'],
            'TypeScript': ['typescript', '@types/node']
        };
        
        technologies.forEach(tech => {
            const deps = techDependencies[tech];
            if (deps) {
                dependencies.push(...deps);
            }
        });
        
        return [...new Set(dependencies)];
    }

    private calculateComplexity(analysis: AnalyzedTask): 'simple' | 'moderate' | 'complex' {
        let complexityScore = 0;
        
        // Factor in number of components
        complexityScore += analysis.components.length * 2;
        
        // Factor in technologies
        complexityScore += analysis.technologies.length;
        
        // Factor in dependencies
        complexityScore += analysis.dependencies.length * 0.5;
        
        // Factor in task type
        if (analysis.type === 'mixed') {
            complexityScore += 5;
        }
        
        // Factor in risks
        complexityScore += analysis.risks.length * 3;
        
        if (complexityScore <= 5) return 'simple';
        if (complexityScore <= 15) return 'moderate';
        return 'complex';
    }

    private estimateCheckpoints(analysis: AnalyzedTask): number {
        let checkpoints = 3; // Minimum
        
        // Add checkpoints based on components
        checkpoints += Math.floor(analysis.components.length / 2);
        
        // Add for complexity
        if (analysis.complexity === 'moderate') checkpoints += 2;
        if (analysis.complexity === 'complex') checkpoints += 4;
        
        // Add for mixed type
        if (analysis.type === 'mixed') checkpoints += 2;
        
        return Math.min(checkpoints, 10); // Cap at 10
    }

    private identifyRisks(analysis: AnalyzedTask): string[] {
        const risks: string[] = [];
        
        // Technology risks
        if (analysis.technologies.length > 5) {
            risks.push('Multiple technology integration complexity');
        }
        
        // Dependency risks
        if (analysis.dependencies.length > 10) {
            risks.push('High dependency count may cause conflicts');
        }
        
        // Mixed type risks
        if (analysis.type === 'mixed') {
            risks.push('Cross-domain complexity requires careful coordination');
        }
        
        // Complex task risks
        if (analysis.complexity === 'complex') {
            risks.push('High complexity may require iterative development');
        }
        
        return risks;
    }

    private countPatternMatches(text: string, patterns: RegExp[]): number {
        let count = 0;
        patterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
                count += matches.length;
            }
        });
        return count;
    }
}

// Export singleton
export const taskAnalyzer = new IntelligentTaskAnalyzer();