import React, { useState } from 'react';
import { claudeExecutor } from '../api/claude-executor';

interface DecomposeTaskButtonProps {
  request: string;
  context?: string;
  onDecomposed?: (result: any) => void;
  onExecute?: (result: any) => void;
  className?: string;
}

export const DecomposeTaskButton: React.FC<DecomposeTaskButtonProps> = ({
  request,
  context,
  onDecomposed,
  onExecute,
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'decomposing' | 'executing' | 'done'>('idle');
  const [decomposedTask, setDecomposedTask] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDecomposeAndExecute = async () => {
    if (!request.trim()) {
      setError('Please enter a task description');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatus('decomposing');

    try {
      // Step 1: Decompose the task into checkpoints
      console.log('Decomposing task...');
      const decomposeResponse = await fetch('/api/tasks/decompose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ request, context }),
      });

      if (!decomposeResponse.ok) {
        throw new Error('Failed to decompose task');
      }

      const decomposed = await decomposeResponse.json();
      setDecomposedTask(decomposed.task);
      
      if (onDecomposed) {
        onDecomposed(decomposed);
      }

      // Step 2: Execute with Claude on Fly.io
      setStatus('executing');
      console.log('Executing with Claude...');
      
      const executeResponse = await fetch('/api/claude/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: decomposed.claudeFormat,
          context: {
            projectMd: context,
            checkpoints: decomposed.task.checkpoints
          }
        }),
      });

      if (!executeResponse.ok) {
        throw new Error('Failed to execute task');
      }

      const executionResult = await executeResponse.json();
      
      setStatus('done');
      
      if (onExecute) {
        onExecute({
          ...executionResult,
          decomposedTask: decomposed.task
        });
      }

      console.log('Task decomposed and execution started:', executionResult);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Failed to decompose and execute task');
      setStatus('idle');
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonText = () => {
    switch (status) {
      case 'decomposing':
        return '🔍 Decomposing Task...';
      case 'executing':
        return '🚀 Executing with Claude...';
      case 'done':
        return '✅ Task Sent to Claude';
      default:
        return 'Decompose Task';
    }
  };

  const buttonStyle: React.CSSProperties = {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    background: status === 'done' ? '#28a745' : '#007bff',
    border: 'none',
    borderRadius: '6px',
    cursor: isLoading ? 'wait' : 'pointer',
    opacity: isLoading ? 0.7 : 1,
    transition: 'all 0.3s ease',
    ...(className ? {} : {})
  };

  return (
    <div>
      <button
        onClick={handleDecomposeAndExecute}
        disabled={isLoading || !request.trim()}
        style={buttonStyle}
        className={className}
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
          fontSize: '14px'
        }}>
          ❌ {error}
        </div>
      )}

      {decomposedTask && status !== 'idle' && (
        <div style={{
          marginTop: '15px',
          padding: '15px',
          background: '#e7f3ff',
          borderRadius: '6px',
          fontSize: '14px'
        }}>
          <strong>📋 Checkpoints Created:</strong>
          <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
            {decomposedTask.checkpoints.map((cp: any, index: number) => (
              <li key={cp.id} style={{ marginBottom: '5px' }}>
                <strong>{cp.name}</strong> - {cp.description}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: '10px', fontSize: '13px', color: '#666' }}>
            Complexity: {decomposedTask.complexity} | 
            Estimated: {decomposedTask.estimatedTime}
          </div>
        </div>
      )}
    </div>
  );
};