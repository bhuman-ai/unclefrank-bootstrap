# Project.md Validation System

## Overview

Uncle Frank's bulletproof validation system that enforces the sacred flow from Claude.md. No changes to Project.md can bypass validation - period.

## Architecture

### Components

1. **InterfaceRules** - Parses and validates UI/UX rules from Interface.md
2. **TechnicalRules** - Parses and validates technical constraints from Technical.md  
3. **LogicValidator** - Detects logical contradictions within content
4. **ChangeInterceptor** - Real-time file watching and validation
5. **ProjectValidator** - Main orchestrator that combines all validators

### Validation Flow

```
Project.md Change → Interceptor → Parse Rules → Validate → Block/Allow
                                       ↓
                              Interface.md Rules
                              Technical.md Constraints
                              Logic Coherence Check
                              Cross-Document References
```

## Usage

### CLI Commands

```bash
# Validate current Project.md
npm run validate

# Watch for changes in real-time
npm run validate:watch

# Run test suite
npm run validate:test

# Validate specific draft
npx tsx src/validation/cli.ts validate-draft draft.md
```

### Programmatic Usage

```typescript
import { ProjectValidator } from './validation';

const validator = new ProjectValidator(workingDir);
await validator.initialize();

// Validate a draft
const result = await validator.validateDraft(draft);
if (!result.valid) {
  console.error('Violations:', result.errors);
}

// Start watching for changes
validator.startWatching();
```

## Validation Rules

### Interface.md Rules
- Layout consistency (3/4 editor, 1/4 chat)
- Screen structure requirements
- Interaction flow enforcement
- Contextual linking validation

### Technical.md Constraints
- Performance limits (load time, response time)
- Architecture requirements (RESTful, error handling)
- Security constraints (input validation, HTTPS)
- Scalability limits (concurrent users, file sizes)

### Logic Validation
- Circular dependency detection
- Conflicting state requirements
- Min/max constraint conflicts
- Flow contradiction detection

### Sacred Flow Enforcement
- No bypassing allowed
- Draft → Validation → Task → Checkpoint → Review
- Human approval required for merges
- Single active draft rule

## Test Coverage

The system includes comprehensive tests for:
- Valid Project.md documents
- Bypass attempts (blocked)
- Missing sacred flow (blocked)
- Auto-merge without approval (blocked)
- Multiple active drafts (blocked)
- Circular dependencies (blocked)
- Conflicting constraints (blocked)

## Error Messages

All violations include:
- Error type (ux/technical/logic)
- Clear description of the violation
- Suggestions for fixing (when applicable)
- Uncle Frank's colorful commentary

## Integration

The validation system integrates with:
- File system watching for real-time validation
- Git hooks for pre-commit validation
- CI/CD pipelines for automated checks
- The main Uncle Frank bootstrap system

## Uncle Frank Says

"This validator is tighter than a Brooklyn parking spot. Nothing gets past it - and that's how we like it. No shortcuts, no BS, just bulletproof validation that keeps your system honest."