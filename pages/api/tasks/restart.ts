import { NextApiRequest, NextApiResponse } from 'next';
import { claudeExecutor } from '../../../cli/src/api/claude-executor';
import { githubIntegration } from '../../../cli/src/api/github-integration';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      task, 
      originalTask,
      issueNumber, 
      checkpoints,
      complexity,
      estimatedTime
    } = req.body;

    if (!task) {
      return res.status(400).json({ error: 'Task is required' });
    }

    // Close any existing Claude session first
    try {
      await claudeExecutor.closeSession();
    } catch (e) {
      console.log('No existing session to close');
    }

    // Start fresh with the decomposed task
    const result = await claudeExecutor.executeTask({
      task,
      context: {
        checkpoints,
        complexity,
        estimatedTime,
        isRestart: true,
        originalIssue: issueNumber
      }
    });

    // Get the new session status
    const status = await claudeExecutor.getSessionStatus();

    // Update the existing GitHub issue if we have one
    if (issueNumber) {
      const updateMessage = `## 🔄 Task Restarted with Checkpoint System\n\n` +
        `**New Session:** ${status.sessionId}\n` +
        `**Branch:** ${status.branch}\n` +
        `**Checkpoints:** ${checkpoints.length} defined\n` +
        `**Complexity:** ${complexity}\n` +
        `**Estimated Time:** ${estimatedTime}\n\n` +
        `### Checkpoints:\n` +
        checkpoints.map((cp, i) => `${i + 1}. **${cp.name}**\n   - ${cp.description}`).join('\n') +
        `\n\n---\n*Task restarted using Uncle Frank's checkpoint decomposition system*`;

      await githubIntegration.updateTaskIssue(parseInt(issueNumber), updateMessage);
    } else {
      // Create a new issue if none exists
      const issue = await githubIntegration.createTaskIssue(
        originalTask || task.split('\n')[0],
        status.sessionId,
        status.branch,
        checkpoints,
        complexity,
        estimatedTime
      );
      
      if (issue) {
        console.log(`Created new GitHub issue #${issue.number} for restarted task`);
      }
    }

    res.status(200).json({
      success: true,
      sessionId: status.sessionId,
      branch: status.branch,
      githubUrl: status.githubUrl,
      issueNumber,
      checkpoints: checkpoints.length,
      message: 'Task restarted with checkpoint decomposition'
    });
  } catch (error) {
    console.error('Task restart error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to restart task',
      details: error
    });
  }
}