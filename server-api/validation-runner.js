// FRANK'S VALIDATION RUNNER - Real validation through Claude, no simulations

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, draftId, draftContent } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'Action required' });
  }

  try {
    switch (action) {
      case 'validate': {
        if (!draftId || !draftContent) {
          return res.status(400).json({ error: 'Draft ID and content required' });
        }

        console.log(`[ValidationRunner] Starting validation for draft ${draftId}`);

        // Create validation task in Claude
        const validationMessage = `# VALIDATION REQUEST

## Draft ID: ${draftId}

## Content to Validate:
\`\`\`markdown
${draftContent}
\`\`\`

## Validation Checks Required:
1. **Syntax Check**: Verify markdown syntax is valid
2. **Structure Check**: Ensure follows Project.md structure with required sections
3. **Conflict Check**: Check for conflicts with current Project.md state
4. **Technical Feasibility**: Verify technical requirements are achievable
5. **Dependency Check**: Ensure no circular dependencies

Please perform these validation checks and report:
- PASS/FAIL for each check
- Specific issues found
- Recommendations for fixes`;

        // Create Claude task for validation
        const createResponse = await fetch(
          `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://unclefrank-bootstrap.vercel.app'}/api/execute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create-task',
              payload: [{
                message: {
                  type: 'user',
                  parts: [{
                    type: 'text',
                    text: validationMessage
                  }]
                }
              }]
            })
          }
        );

        const createData = await createResponse.json();
        
        if (!createResponse.ok || !createData.threadId) {
          throw new Error('Failed to create validation task');
        }

        const validationThreadId = createData.threadId;
        console.log(`[ValidationRunner] Created validation task: ${validationThreadId}`);

        return res.status(200).json({
          success: true,
          validationThreadId,
          draftId,
          status: 'validating',
          message: 'Validation task created in Claude',
          monitorUrl: createData.url
        });
      }

      case 'check-status': {
        const { validationThreadId } = req.body;
        if (!validationThreadId) {
          return res.status(400).json({ error: 'Validation thread ID required' });
        }

        // Check Claude task status
        const statusResponse = await fetch(
          `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://unclefrank-bootstrap.vercel.app'}/api/execute`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'check-status',
              payload: { threadId: validationThreadId }
            })
          }
        );

        const statusData = await statusResponse.json();

        if (!statusResponse.ok) {
          throw new Error('Failed to check validation status');
        }

        // Parse validation results from Claude response
        let validationResults = null;
        if (statusData.completed && statusData.lastResponse) {
          validationResults = parseValidationResults(statusData.lastResponse);
        }

        return res.status(200).json({
          threadId: validationThreadId,
          status: statusData.status,
          completed: statusData.completed,
          validationResults,
          claudeUrl: statusData.url
        });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('[ValidationRunner] Error:', error);
    return res.status(500).json({
      error: 'Validation error',
      details: error.message
    });
  }
}

// Parse validation results from Claude response
function parseValidationResults(response) {
  const results = {
    passed: false,
    checks: {
      syntax: { passed: false, details: '' },
      structure: { passed: false, details: '' },
      conflicts: { passed: false, details: '' },
      technical: { passed: false, details: '' },
      dependencies: { passed: false, details: '' }
    },
    summary: '',
    recommendations: []
  };

  // Look for PASS/FAIL patterns in response
  const lines = response.split('\n');
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Check for specific validation results
    if (lowerLine.includes('syntax') && (lowerLine.includes('pass') || lowerLine.includes('✓'))) {
      results.checks.syntax.passed = true;
      results.checks.syntax.details = line;
    }
    if (lowerLine.includes('structure') && (lowerLine.includes('pass') || lowerLine.includes('✓'))) {
      results.checks.structure.passed = true;
      results.checks.structure.details = line;
    }
    if (lowerLine.includes('conflict') && (lowerLine.includes('pass') || lowerLine.includes('✓'))) {
      results.checks.conflicts.passed = true;
      results.checks.conflicts.details = line;
    }
    if (lowerLine.includes('technical') && (lowerLine.includes('pass') || lowerLine.includes('✓'))) {
      results.checks.technical.passed = true;
      results.checks.technical.details = line;
    }
    if (lowerLine.includes('depend') && (lowerLine.includes('pass') || lowerLine.includes('✓'))) {
      results.checks.dependencies.passed = true;
      results.checks.dependencies.details = line;
    }

    // Look for recommendations
    if (lowerLine.includes('recommend') || lowerLine.includes('suggest')) {
      results.recommendations.push(line);
    }
  }

  // Overall pass/fail
  results.passed = Object.values(results.checks).every(check => check.passed);
  results.summary = results.passed ? 'All validation checks passed' : 'Some validation checks failed';

  return results;
}