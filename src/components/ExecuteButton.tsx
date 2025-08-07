import React, { useState } from 'react';

interface ExecuteButtonProps {
  task: string;
  onResult?: (result: any) => void;
}

export const ExecuteButton: React.FC<ExecuteButtonProps> = ({ task, onResult }) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [status, setStatus] = useState<string>('');

  const executeTask = async () => {
    setIsExecuting(true);
    setStatus('Creating Claude session...');

    try {
      // Call our API to trigger Claude on Fly.io
      const response = await fetch('/api/claude/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task,
          repoUrl: process.env.NEXT_PUBLIC_GITHUB_REPO || 'https://github.com/bhuman-ai/unclefrank-bootstrap'
        }),
      });

      const result = await response.json();
      
      if (result.error) {
        setStatus(`Error: ${result.error}`);
        console.error('Execution error:', result);
      } else {
        setStatus(`Success! Session: ${result.sessionId}`);
        if (onResult) {
          onResult(result);
        }
      }
    } catch (error) {
      setStatus(`Failed: ${error.message}`);
      console.error('Failed to execute task:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="execute-button-container">
      <button
        onClick={executeTask}
        disabled={isExecuting || !task}
        className={`execute-button ${isExecuting ? 'executing' : ''}`}
      >
        {isExecuting ? 'Executing...' : 'Execute with Claude'}
      </button>
      {status && (
        <div className="execution-status">
          {status}
        </div>
      )}
      <style jsx>{`
        .execute-button-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin: 20px 0;
        }
        
        .execute-button {
          background: #0066cc;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .execute-button:hover:not(:disabled) {
          background: #0052a3;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        .execute-button:disabled {
          background: #cccccc;
          cursor: not-allowed;
          opacity: 0.6;
        }
        
        .execute-button.executing {
          background: #ff9500;
          animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
        
        .execution-status {
          padding: 10px;
          border-radius: 4px;
          background: #f0f0f0;
          border-left: 4px solid #0066cc;
          font-family: monospace;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};