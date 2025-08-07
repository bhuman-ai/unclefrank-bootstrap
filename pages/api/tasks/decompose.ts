import { NextApiRequest, NextApiResponse } from 'next';
import { taskDecomposer } from '../../../src/api/task-decomposer';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { request, context } = req.body;

    if (!request) {
      return res.status(400).json({ error: 'Task request is required' });
    }

    // Decompose the task using Frank's methodology
    const decomposedTask = await taskDecomposer.decomposeTask(request, context);

    // Format for Claude execution
    const claudeFormat = taskDecomposer.formatForClaude(decomposedTask);

    res.status(200).json({
      success: true,
      task: decomposedTask,
      claudeFormat
    });
  } catch (error) {
    console.error('Task decomposition error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to decompose task',
      details: error
    });
  }
}