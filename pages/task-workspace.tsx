import React, { useState, useEffect, useRef } from 'react';
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
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [terminalPolling, setTerminalPolling] = useState(false);
  const terminalIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const formatTerminalOutput = (text: string) => {
    if (!text) return 'No output yet...';
    
    // Add color highlighting for different patterns
    return text
      .replace(/(✻\s*(Cerebrating|Hatching|Pondering|Thinking).*tokens)/g, '<span style="color: #60a5fa">$1</span>')
      .replace(/(⎿\s*Running.*)/g, '<span style="color: #34d399">$1</span>')
      .replace(/(###\s*Checkpoint\s*\d+:.*)/g, '<strong style="color: #fbbf24">$1</strong>')
      .replace(/(- Objective:)/g, '<span style="color: #a78bfa">$1</span>')
      .replace(/(- Deliverables:)/g, '<span style="color: #60a5fa">$1</span>')
      .replace(/(- Pass Criteria:)/g, '<span style="color: #34d399">$1</span>');
  };

  const fetchTerminal = async () => {
    if (!task.sessionId) return;
    
    try {
      const response = await fetch(`https://uncle-frank-claude.fly.dev/api/sessions/${task.sessionId}/terminal`);
      if (response.ok) {
        const data = await response.json();
        setTerminalOutput(data.terminal || 'No output yet...');
        
        // Stop polling if session is completed
        if (!data.isProcessing && data.status === 'completed') {
          stopTerminalPolling();
        }
      }
    } catch (error) {
      console.error('Failed to fetch terminal:', error);
    }
  };

  const startTerminalPolling = () => {
    // Fetch immediately
    fetchTerminal();
    
    // Then poll every 2 seconds
    terminalIntervalRef.current = setInterval(fetchTerminal, 2000);
    setTerminalPolling(true);
  };

  const stopTerminalPolling = () => {
    if (terminalIntervalRef.current) {
      clearInterval(terminalIntervalRef.current);
      terminalIntervalRef.current = null;
    }
    setTerminalPolling(false);
  };

  const viewTerminal = () => {
    setShowTerminal(true);
    startTerminalPolling();
  };

  const closeTerminal = () => {
    setShowTerminal(false);
    stopTerminalPolling();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (terminalIntervalRef.current) {
        clearInterval(terminalIntervalRef.current);
      }
    };
  }, []);

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

              <button 
                onClick={viewTerminal}
                style={{
                  background: '#1d9bf0',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                🖥️ View Terminal
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

      {/* Terminal Modal */}
      {showTerminal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#0f1419',
            border: '1px solid #2f3b47',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '1200px',
            height: '80vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Terminal Header */}
            <div style={{
              background: '#1e2936',
              padding: '15px 20px',
              borderBottom: '1px solid #2f3b47',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderRadius: '8px 8px 0 0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <h3 style={{ margin: 0, color: '#e1e8ed' }}>Claude Terminal</h3>
                {terminalPolling && (
                  <span style={{
                    background: '#0e7490',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    Live Streaming
                  </span>
                )}
              </div>
              <button
                onClick={closeTerminal}
                style={{
                  background: 'transparent',
                  border: '1px solid #2f3b47',
                  color: '#8899a6',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Close
              </button>
            </div>

            {/* Terminal Content */}
            <div 
              style={{
                flex: 1,
                padding: '20px',
                overflow: 'auto',
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: '13px',
                lineHeight: '1.6',
                color: '#d4d4d4',
                background: '#1a1f2a',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
              dangerouslySetInnerHTML={{ __html: formatTerminalOutput(terminalOutput) }}
            />

            {/* Terminal Footer */}
            <div style={{
              padding: '10px 20px',
              borderTop: '1px solid #2f3b47',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#1e2936',
              borderRadius: '0 0 8px 8px'
            }}>
              <div style={{ fontSize: '12px', color: '#8899a6' }}>
                Session ID: {task.sessionId}
              </div>
              <div style={{ fontSize: '12px', color: '#8899a6' }}>
                {terminalPolling ? 'Auto-refreshing every 2 seconds' : 'Streaming stopped'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}