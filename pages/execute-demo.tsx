import React, { useState } from 'react';
import { ExecuteButton } from '../src/components/ExecuteButton';

export default function ExecuteDemo() {
  const [task, setTask] = useState('');
  const [result, setResult] = useState<any>(null);
  const [checkpoints, setCheckpoints] = useState<string[]>(['']);

  const handleAddCheckpoint = () => {
    setCheckpoints([...checkpoints, '']);
  };

  const handleCheckpointChange = (index: number, value: string) => {
    const updated = [...checkpoints];
    updated[index] = value;
    setCheckpoints(updated);
  };

  const handleRemoveCheckpoint = (index: number) => {
    setCheckpoints(checkpoints.filter((_, i) => i !== index));
  };

  const handleResult = (executionResult: any) => {
    setResult(executionResult);
    console.log('Execution result:', executionResult);
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1 style={{ color: '#333', marginBottom: '30px' }}>
        🚀 Uncle Frank's Claude Executor
      </h1>
      
      <div style={{ maxWidth: '800px' }}>
        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
            What needs to get done?
          </label>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Example: Create a user authentication system with JWT tokens"
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '12px',
              fontSize: '16px',
              border: '2px solid #ddd',
              borderRadius: '6px',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600' }}>
            Checkpoints (optional)
          </label>
          {checkpoints.map((checkpoint, index) => (
            <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input
                value={checkpoint}
                onChange={(e) => handleCheckpointChange(index, e.target.value)}
                placeholder={`Checkpoint ${index + 1}: e.g., "Create user model"`}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
              <button
                onClick={() => handleRemoveCheckpoint(index)}
                style={{
                  padding: '10px 15px',
                  background: '#ff4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={handleAddCheckpoint}
            style={{
              padding: '10px 20px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            + Add Checkpoint
          </button>
        </div>

        <ExecuteButton 
          task={task}
          onResult={handleResult}
        />

        {result && (
          <div style={{
            marginTop: '30px',
            padding: '20px',
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <h3 style={{ marginTop: 0, color: '#28a745' }}>✅ Execution Started</h3>
            <div style={{ fontFamily: 'monospace', fontSize: '14px' }}>
              <p><strong>Session ID:</strong> {result.sessionId}</p>
              <p><strong>Branch:</strong> {result.branch}</p>
              <p><strong>GitHub URL:</strong> 
                <a href={result.githubUrl} target="_blank" rel="noopener noreferrer" 
                   style={{ marginLeft: '10px', color: '#0066cc' }}>
                  {result.githubUrl}
                </a>
              </p>
            </div>
            <details style={{ marginTop: '15px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: '600' }}>
                Full Response
              </summary>
              <pre style={{ 
                marginTop: '10px',
                padding: '10px',
                background: 'white',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px'
              }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}

        <div style={{
          marginTop: '40px',
          padding: '20px',
          background: '#fff3cd',
          borderRadius: '8px',
          border: '1px solid #ffc107'
        }}>
          <h4 style={{ marginTop: 0, color: '#856404' }}>ℹ️ How it works:</h4>
          <ol style={{ marginBottom: 0, paddingLeft: '20px', color: '#856404' }}>
            <li>Enter a task description - be specific, Frank likes clarity</li>
            <li>Optionally add checkpoints for structured execution</li>
            <li>Click "Execute with Claude" to send the task to Claude on Fly.io</li>
            <li>Claude will create a branch, execute the task, and track progress</li>
            <li>Check the GitHub URL to see the changes and PR when complete</li>
          </ol>
        </div>
      </div>
    </div>
  );
}