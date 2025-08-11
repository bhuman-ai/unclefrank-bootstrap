import React, { useState } from 'react';
import { DecomposeTaskButton } from '../cli/src/components/DecomposeTaskButton';

export default function TaskCreate() {
  const [request, setRequest] = useState('');
  const [context, setContext] = useState('');
  const [result, setResult] = useState<any>(null);
  const [decomposedTask, setDecomposedTask] = useState<any>(null);

  const handleDecomposed = (decomposeResult: any) => {
    setDecomposedTask(decomposeResult.task);
    console.log('Task decomposed:', decomposeResult);
  };

  const handleExecute = (executionResult: any) => {
    setResult(executionResult);
    console.log('Execution started:', executionResult);
  };

  return (
    <div style={{ 
      padding: '40px', 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <div style={{
        background: '#2c3e50',
        color: 'white',
        padding: '30px',
        borderRadius: '10px',
        marginBottom: '30px'
      }}>
        <h1 style={{ margin: 0, fontSize: '32px' }}>Create New Task</h1>
      </div>

      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '25px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '10px', 
            fontWeight: '600',
            fontSize: '18px'
          }}>
            Request
          </label>
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="Implement Task Review UI that shows completed tasks awaiting human review with GitHub integration. This must include: 1) Task Queue view showing tasks with 'Awaiting Review' status after Claude completes them 2) Blocks the GitHub integration to keep tasks..."
            style={{
              width: '100%',
              minHeight: '150px',
              padding: '15px',
              fontSize: '16px',
              border: '2px solid #ddd',
              borderRadius: '6px',
              fontFamily: 'inherit',
              resize: 'vertical',
              background: '#f8f9fa'
            }}
          />
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '10px', 
            fontWeight: '600',
            fontSize: '18px'
          }}>
            Project Context (optional)
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="# Current State
The system can execute tasks in Claude, which creates GitHub branches, but there's no UI to review and approve these completed tasks. All created branches need human review..."
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '15px',
              fontSize: '16px',
              border: '2px solid #ddd',
              borderRadius: '6px',
              fontFamily: 'monospace',
              resize: 'vertical',
              background: '#f8f9fa'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
          <button
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              background: '#6c757d',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Classify
          </button>

          <DecomposeTaskButton
            request={request}
            context={context}
            onDecomposed={handleDecomposed}
            onExecute={handleExecute}
          />
        </div>

        {result && (
          <div style={{
            marginTop: '30px',
            padding: '20px',
            background: '#d4edda',
            borderRadius: '8px',
            border: '1px solid #c3e6cb'
          }}>
            <h3 style={{ marginTop: 0, color: '#155724' }}>
              ✅ Task Execution Started
            </h3>
            <div style={{ fontFamily: 'monospace', fontSize: '14px', color: '#155724' }}>
              <p><strong>Session ID:</strong> {result.sessionId}</p>
              <p><strong>Branch:</strong> {result.branch}</p>
              <p>
                <strong>GitHub URL:</strong>
                <a 
                  href={result.githubUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ marginLeft: '10px', color: '#0066cc' }}
                >
                  {result.githubUrl}
                </a>
              </p>
              {result.decomposedTask && (
                <div style={{ marginTop: '15px' }}>
                  <strong>Checkpoints:</strong> {result.decomposedTask.checkpoints.length} created
                  <br />
                  <strong>Complexity:</strong> {result.decomposedTask.complexity}
                  <br />
                  <strong>Estimated Time:</strong> {result.decomposedTask.estimatedTime}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{
        marginTop: '30px',
        padding: '20px',
        background: '#fff3cd',
        borderRadius: '8px',
        border: '1px solid #ffc107'
      }}>
        <h4 style={{ marginTop: 0, color: '#856404' }}>
          ℹ️ How Task Decomposition Works
        </h4>
        <ol style={{ marginBottom: 0, paddingLeft: '20px', color: '#856404' }}>
          <li>Enter your task request - Uncle Frank needs clarity</li>
          <li>Add optional context about the current project state</li>
          <li>Click "Decompose Task" to break it into checkpoints</li>
          <li>System automatically sends decomposed task to Claude on Fly.io</li>
          <li>Claude creates a GitHub branch and executes each checkpoint</li>
          <li>Check GitHub for the PR when complete</li>
        </ol>
        <p style={{ marginTop: '15px', marginBottom: 0, fontStyle: 'italic', color: '#856404' }}>
          <strong>Frank's Rule:</strong> Every task gets broken down into binary Pass/Fail checkpoints. 
          No checkpoint gets skipped. If it fails, it gets fixed before moving on.
        </p>
      </div>
    </div>
  );
}