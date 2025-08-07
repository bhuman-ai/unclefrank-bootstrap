import React, { useState } from 'react';
import { taskDecomposer } from '../api/task-decomposer';

interface RestartTaskButtonProps {
  taskDescription: string;
  issueNumber?: string;
  sessionId?: string;
  onRestart?: (result: any) => void;
  className?: string;
}

export const RestartTaskButton: React.FC<RestartTaskButtonProps> = ({
  taskDescription,
  issueNumber,
  sessionId,
  onRestart,
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'decomposing' | 'restarting' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleRestartTask = async () => {
    setIsLoading(true);
    setError(null);
    setStatus('decomposing');

    try {
      // Step 1: Skip session deletion - just log it
      if (sessionId) {
        console.log('Previous session:', sessionId);
        // Don't try to delete - Vercel deployment doesn't support this
      }

      // Step 2: Use task decomposer directly without API call
      console.log('Decomposing task locally...');
      const decomposed = await taskDecomposer.decomposeTask(
        taskDescription,
        `Restarting existing task from Issue #${issueNumber}`
      );
      
      // Step 3: Create new Claude session on Fly.io directly
      setStatus('restarting');
      console.log('Creating new Claude session on Fly.io...');
      
      const claudeResponse = await fetch('https://uncle-frank-claude.fly.dev/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoUrl: 'https://github.com/bhuman-ai/unclefrank-bootstrap'
        }),
      });

      if (!claudeResponse.ok) {
        const errorText = await claudeResponse.text();
        throw new Error(`Failed to create Claude session: ${errorText}`);
      }

      const session = await claudeResponse.json();
      
      // Step 4: Execute the task with the decomposed format
      console.log('Executing task on Claude...');
      const executeResponse = await fetch(`https://uncle-frank-claude.fly.dev/api/sessions/${session.sessionId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: decomposed.claudeFormat
        })
      });
      
      if (!executeResponse.ok) {
        const errorText = await executeResponse.text();
        throw new Error(`Failed to execute task: ${errorText}`);
      }
      
      const restartResult = await executeResponse.json();
      
      setStatus('done');
      
      if (onRestart) {
        onRestart({
          sessionId: session.sessionId,
          branch: session.branch,
          githubUrl: session.githubUrl,
          response: restartResult.response,
          decomposedTask: decomposed,
          issueNumber
        });
      }

      console.log('Task restarted successfully:', {
        sessionId: session.sessionId,
        branch: session.branch,
        response: restartResult.response?.substring(0, 100)
      });
      
      // Reload the page after a short delay to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (err) {
      console.error('Error restarting task:', err);
      setError(err.message || 'Failed to restart task');
      setStatus('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonText = () => {
    switch (status) {
      case 'decomposing':
        return '🔍 Analyzing Task...';
      case 'restarting':
        return '🚀 Restarting with Checkpoints...';
      case 'done':
        return '✅ Task Restarted';
      default:
        return '🔄 Restart Task';
    }
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'white',
    background: status === 'done' ? '#28a745' : '#ff9800',
    border: 'none',
    borderRadius: '6px',
    cursor: isLoading ? 'wait' : 'pointer',
    opacity: isLoading ? 0.7 : 1,
    transition: 'all 0.3s ease',
    ...(className ? {} : {})
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        onClick={handleRestartTask}
        disabled={isLoading || !taskDescription}
        style={buttonStyle}
        className={className}
        title="Restart task with checkpoint decomposition"
      >
        {getButtonText()}
      </button>
      
      {error && (
        <div style={{
          marginTop: '10px',
          padding: '10px',
          background: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          ❌ {error}
        </div>
      )}

      {status === 'done' && (
        <div style={{
          marginTop: '10px',
          padding: '10px',
          background: '#d4edda',
          color: '#155724',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          ✅ Task restarted with checkpoint system. Refreshing...
        </div>
      )}
    </div>
  );
};