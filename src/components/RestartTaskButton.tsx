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
      // Step 1: Close existing session if it exists
      if (sessionId) {
        console.log('Closing existing session:', sessionId);
        await fetch(`/api/claude/sessions/${sessionId}`, {
          method: 'DELETE'
        });
      }

      // Step 2: Decompose the task using the new system
      console.log('Decomposing task with new system...');
      const decomposeResponse = await fetch('/api/tasks/decompose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          request: taskDescription,
          context: `Restarting existing task from Issue #${issueNumber}`
        }),
      });

      if (!decomposeResponse.ok) {
        throw new Error('Failed to decompose task');
      }

      const decomposed = await decomposeResponse.json();
      
      // Step 3: Restart execution with decomposed checkpoints
      setStatus('restarting');
      console.log('Restarting task with checkpoints...');
      
      const restartResponse = await fetch('/api/tasks/restart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: decomposed.claudeFormat,
          originalTask: taskDescription,
          issueNumber,
          checkpoints: decomposed.task.checkpoints,
          complexity: decomposed.task.complexity,
          estimatedTime: decomposed.task.estimatedTime
        }),
      });

      if (!restartResponse.ok) {
        throw new Error('Failed to restart task');
      }

      const restartResult = await restartResponse.json();
      
      setStatus('done');
      
      if (onRestart) {
        onRestart({
          ...restartResult,
          decomposedTask: decomposed.task,
          issueNumber
        });
      }

      console.log('Task restarted successfully:', restartResult);
      
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