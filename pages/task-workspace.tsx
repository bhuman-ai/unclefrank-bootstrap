import React, { useState, useEffect } from 'react';
import { RestartTaskButton } from '../src/components/RestartTaskButton';

interface TaskData {
  description: string;
  status: string;
  issueNumber: string;
  sessionId: string;
  checkpoints: any[];
  executionLogs: string[];
}

export default function TaskWorkspace() {
  const [task, setTask] = useState<TaskData>({
    description: "We need a real document management system that tracks Project.md drafts and enforces the sacred flow...",
    status: "In Progress",
    issueNumber: "61",
    sessionId: "63ea12de-eaa...",
    checkpoints: [],
    executionLogs: []
  });

  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const handleRestart = (result: any) => {
    console.log('Task restarted:', result);
    // Update UI with new data
    if (result.decomposedTask) {
      setTask(prev => ({
        ...prev,
        checkpoints: result.decomposedTask.checkpoints,
        sessionId: result.sessionId,
        status: "Restarting"
      }));
    }
  };

  const headerStyle: React.CSSProperties = {
    background: '#1e2936',
    color: 'white',
    padding: '20px 30px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const containerStyle: React.CSSProperties = {
    background: '#0f1419',
    minHeight: '100vh',
    color: '#e1e8ed',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  };

  const workspaceStyle: React.CSSProperties = {
    padding: '30px',
    maxWidth: '1400px',
    margin: '0 auto'
  };

  const cardStyle: React.CSSProperties = {
    background: '#192734',
    borderRadius: '10px',
    padding: '25px',
    marginBottom: '20px',
    border: '1px solid #2f3b47'
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '300px 1fr 1fr',
    gap: '20px',
    marginTop: '20px'
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button style={{ 
            background: 'none', 
            border: 'none', 
            color: 'white', 
            fontSize: '20px',
            cursor: 'pointer'
          }}>
            ←
          </button>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Uncle Frank's Bootstrap Core</h1>
        </div>
        <div style={{ display: 'flex', gap: '20px', fontSize: '14px' }}>
          <span style={{ color: '#28a745' }}>● GitHub: Connected</span>
          <span style={{ color: '#28a745' }}>● Claude: Online</span>
          <button style={{
            background: 'none',
            border: '1px solid #495057',
            color: '#adb5bd',
            padding: '5px 15px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Workspace */}
      <div style={workspaceStyle}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '28px', marginBottom: '10px' }}>Task Workspace</h2>
            <p style={{ margin: 0, color: '#8899a6', fontSize: '16px' }}>
              {task.description}
            </p>
          </div>
          <button style={{
            background: 'none',
            border: 'none',
            color: '#8899a6',
            fontSize: '24px',
            cursor: 'pointer'
          }}>
            ✕
          </button>
        </div>

        <div style={gridStyle}>
          {/* Task Details */}
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, color: '#4a9eff', marginBottom: '20px' }}>Task Details</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#8899a6', fontSize: '12px', display: 'block', marginBottom: '5px' }}>
                Status
              </label>
              <span style={{
                background: '#1d9bf0',
                color: 'white',
                padding: '5px 12px',
                borderRadius: '15px',
                fontSize: '14px',
                display: 'inline-block'
              }}>
                {task.status}
              </span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#8899a6', fontSize: '12px', display: 'block', marginBottom: '5px' }}>
                GitHub Integration
              </label>
              <a href={`#issue-${task.issueNumber}`} style={{ color: '#4a9eff', textDecoration: 'none' }}>
                Issue #{task.issueNumber} ↗
              </a>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ color: '#8899a6', fontSize: '12px', display: 'block', marginBottom: '5px' }}>
                Claude Session
              </label>
              <span style={{ color: '#e1e8ed', fontSize: '14px', fontFamily: 'monospace' }}>
                {task.sessionId}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button style={{
                background: '#ff9800',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
                Pause Execution
              </button>

              <RestartTaskButton
                taskDescription={task.description}
                issueNumber={task.issueNumber}
                sessionId={task.sessionId}
                onRestart={handleRestart}
              />

              <button style={{
                background: 'transparent',
                color: '#8899a6',
                border: '1px solid #2f3b47',
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}>
                View Full Session
              </button>
            </div>
          </div>

          {/* Checkpoints */}
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, color: '#28a745', marginBottom: '20px' }}>Checkpoints</h3>
            {task.checkpoints.length === 0 ? (
              <div style={{ color: '#8899a6', fontSize: '14px' }}>
                <p>No checkpoints defined</p>
                <p style={{ marginTop: '15px', fontSize: '13px' }}>
                  Click "Restart Task" to decompose this task into checkpoints using Frank's methodology.
                </p>
              </div>
            ) : (
              <div style={{ fontSize: '14px' }}>
                {task.checkpoints.map((checkpoint, index) => (
                  <div key={checkpoint.id} style={{
                    padding: '12px',
                    background: '#0f1419',
                    borderRadius: '6px',
                    marginBottom: '10px',
                    border: '1px solid #2f3b47'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                      <input type="checkbox" checked={checkpoint.status === 'completed'} readOnly />
                      <strong>{checkpoint.name}</strong>
                    </div>
                    <div style={{ color: '#8899a6', fontSize: '12px', marginLeft: '25px' }}>
                      {checkpoint.description}
                    </div>
                    <div style={{ color: '#4a9eff', fontSize: '11px', marginLeft: '25px', marginTop: '5px' }}>
                      Pass/Fail: {checkpoint.passFail}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Execution Logs */}
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, color: '#e1e8ed', marginBottom: '20px' }}>Execution Logs</h3>
            {task.executionLogs.length === 0 ? (
              <p style={{ color: '#8899a6', fontSize: '14px' }}>
                No execution logs available
              </p>
            ) : (
              <div style={{
                background: '#0f1419',
                padding: '15px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '12px',
                maxHeight: '400px',
                overflow: 'auto'
              }}>
                {task.executionLogs.map((log, index) => (
                  <div key={index} style={{ marginBottom: '5px' }}>
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Project.md Draft Management Section */}
        <div style={{ ...cardStyle, marginTop: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '20px', color: '#e1e8ed' }}>
              📁 Project.md Draft Management
            </h3>
            <button style={{
              background: '#1d9bf0',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              New Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}