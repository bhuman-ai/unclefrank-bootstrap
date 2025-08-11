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
    const { task, repoUrl, context } = req.body;

    if (!task) {
      return res.status(400).json({ error: 'Task is required' });
    }

    // Execute the task using Claude on Fly.io
    const result = await claudeExecutor.executeTask({
      task,
      repoUrl,
      context
    });

    // Get the session ID for tracking
    const status = await claudeExecutor.getSessionStatus();

    // Create GitHub issue for task tracking if we have checkpoints
    let issueNumber = null;
    if (context?.checkpoints && context.checkpoints.length > 0) {
      const issue = await githubIntegration.createTaskIssue(
        task.split('\n')[0], // Use first line as request summary
        status.sessionId,
        status.branch,
        context.checkpoints,
        context.complexity || 'moderate',
        context.estimatedTime || 'TBD'
      );
      
      if (issue) {
        issueNumber = issue.number;
        console.log(`Created GitHub issue #${issueNumber} for task tracking`);
      }
    }

    res.status(200).json({
      success: true,
      sessionId: status.sessionId,
      branch: status.branch,
      githubUrl: status.githubUrl,
      issueNumber,
      result
    });
  } catch (error) {
    console.error('Claude execution error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to execute task',
      details: error
    });
  }
}