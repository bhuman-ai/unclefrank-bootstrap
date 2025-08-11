import React, { useState, useRef } from 'react';

interface TaskCardProps {
  task: {
    id: string;
    name: string;
    description: string;
    status: string;
    sessionId: string;
    issueNumber?: string;
    checkpoints?: any[];
  };
  onExecute?: () => void;
  onRestart?: () => void;
}

export const TaskCardWithTerminal: React.FC<TaskCardProps> = ({ task, onExecute, onRestart }) => {
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [terminalPolling, setTerminalPolling] = useState(false);
  const terminalIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  return (
    <>
      <div style={{
        background: '#1a2332',
        border: '1px solid #2f3b47',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        {/* Task Header */}
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ 
            margin: '0 0 8px 0', 
            color: '#e1e8ed',
            fontSize: '18px',
            fontWeight: '600'
          }}>
            {task.name}
          </h3>
          <p style={{ 
            margin: '0 0 10px 0', 
            color: '#8899a6',
            fontSize: '14px',
            lineHeight: '1.5'
          }}>
            {task.description}
          </p>
        </div>

        {/* Task Meta */}
        <div style={{ 
          display: 'flex', 
          gap: '15px', 
          marginBottom: '15px',
          fontSize: '13px',
          color: '#8899a6'
        }}>
          {task.issueNumber && (
            <span>Issue #{task.issueNumber}</span>
          )}
          <span>Status: {task.status}</span>
          {task.checkpoints && (
            <span>{task.checkpoints.length} checkpoints</span>
          )}
        </div>

        {/* Session Info */}
        {task.sessionId && (
          <div style={{
            background: '#0f1419',
            border: '1px solid #2f3b47',
            borderRadius: '4px',
            padding: '10px',
            marginBottom: '15px',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            <span style={{ color: '#8899a6' }}>Claude Session: </span>
            <span style={{ color: '#60a5fa' }}>{task.sessionId}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={viewTerminal}
            style={{
              background: '#1d9bf0',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            View Terminal
          </button>

          {onExecute && (
            <button
              onClick={onExecute}
              style={{
                background: '#28a745',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Execute Scenario
            </button>
          )}

          {onRestart && (
            <button
              onClick={onRestart}
              style={{
                background: 'transparent',
                color: '#8899a6',
                border: '1px solid #2f3b47',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Restart Task
            </button>
          )}
        </div>

        {/* Checkpoints Section (if exists) */}
        {task.checkpoints && task.checkpoints.length > 0 && (
          <div style={{
            marginTop: '20px',
            paddingTop: '20px',
            borderTop: '1px solid #2f3b47'
          }}>
            <h4 style={{ 
              margin: '0 0 15px 0', 
              color: '#e1e8ed',
              fontSize: '16px'
            }}>
              Checkpoints
            </h4>
            <div style={{ fontSize: '14px' }}>
              {task.checkpoints.map((checkpoint: any, index: number) => (
                <div key={index} style={{
                  background: '#0f1419',
                  border: '1px solid #2f3b47',
                  borderRadius: '4px',
                  padding: '12px',
                  marginBottom: '10px'
                }}>
                  <div style={{ fontWeight: '600', color: '#e1e8ed', marginBottom: '5px' }}>
                    {index + 1}. {checkpoint.name}
                  </div>
                  {checkpoint.objective && (
                    <div style={{ color: '#8899a6', fontSize: '13px' }}>
                      {checkpoint.objective}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
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
    </>
  );
};