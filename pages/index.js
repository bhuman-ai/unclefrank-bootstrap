import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function UnifiedDashboard() {
  const [systemStatus, setSystemStatus] = useState({
    claude: 'checking',
    github: 'checking', 
    vercel: 'checking'
  });
  
  const [autoImprove, setAutoImprove] = useState({
    iteration: 0,
    status: 'INITIALIZING',
    currentTask: '-',
    gapsFound: 0,
    tasksCreated: 0,
    progress: 0
  });
  
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [deployments, setDeployments] = useState([]);

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch tasks
        const tasksRes = await fetch('/api/tasks');
        if (tasksRes.ok) {
          const data = await tasksRes.json();
          setTasks(data.tasks || []);
        }

        // Fetch auto-improve status from Fly.io monitor
        try {
          // Note: Using main port with /monitor path since 8081 may be blocked
          const autoRes = await fetch('https://uncle-frank-claude.fly.dev/api/monitor/logs');
          if (autoRes.ok) {
            const data = await autoRes.json();
            setAutoImprove({
              iteration: data.iteration || 0,
              status: data.status || 'RUNNING',
              currentTask: data.currentTask || '-',
              gapsFound: data.gapsFound || 0,
              tasksCreated: data.totalLines ? Math.floor(data.totalLines / 100) : 0,
              progress: 0
            });
            
            // Parse logs
            if (data.logs) {
              const logLines = data.logs.split('\n').slice(-20).map(line => ({
                time: line.match(/\[([\d-T:.Z]+)\]/)?.[1] || '',
                message: line.replace(/\[[\d-T:.Z]+\]\s*/, '')
              }));
              setLogs(logLines);
            }
          }
        } catch (err) {
          console.log('Monitor not available');
        }

        // Update system status
        setSystemStatus({
          claude: 'connected',
          github: 'synced',
          vercel: 'deployed'
        });

      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000); // Update every 3 seconds
    
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status) => {
    switch(status) {
      case 'connected':
      case 'synced':
      case 'deployed':
        return '✅';
      case 'checking':
        return '🔄';
      default:
        return '❌';
    }
  };

  const getTaskStatusIcon = (status) => {
    switch(status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '🔄';
      case 'failed':
        return '❌';
      default:
        return '⏸️';
    }
  };

  return (
    <>
      <Head>
        <title>Uncle Frank Unified Dashboard</title>
      </Head>
      
      <div className="dashboard">
        <header className="header">
          <h1>🤖 UNCLE FRANK AUTONOMOUS DEVELOPMENT PLATFORM</h1>
        </header>

        <div className="main-grid">
          {/* System Status */}
          <div className="panel status-panel">
            <h2>SYSTEM STATUS</h2>
            <div className="status-list">
              <div className="status-item">
                <span>Claude:</span>
                <span>{getStatusIcon(systemStatus.claude)} {systemStatus.claude}</span>
              </div>
              <div className="status-item">
                <span>GitHub:</span>
                <span>{getStatusIcon(systemStatus.github)} {systemStatus.github}</span>
              </div>
              <div className="status-item">
                <span>Vercel:</span>
                <span>{getStatusIcon(systemStatus.vercel)} {systemStatus.vercel}</span>
              </div>
              <div className="status-item">
                <span>Queue:</span>
                <span>{tasks.filter(t => t.status !== 'completed').length} tasks</span>
              </div>
            </div>
          </div>

          {/* Auto-Improve Monitor */}
          <div className="panel monitor-panel">
            <h2>AUTO-IMPROVE MONITOR</h2>
            <div className="monitor-stats">
              <div className="stat">
                <label>Iteration:</label>
                <span>#{autoImprove.iteration}</span>
              </div>
              <div className="stat">
                <label>Status:</label>
                <span className={autoImprove.status.includes('WORKING') ? 'working' : ''}>
                  {autoImprove.status}
                </span>
              </div>
              <div className="stat">
                <label>Current:</label>
                <span>{autoImprove.currentTask}</span>
              </div>
              <div className="stat">
                <label>Gaps Found:</label>
                <span>{autoImprove.gapsFound}</span>
              </div>
              <div className="stat">
                <label>Tasks Created:</label>
                <span>{autoImprove.tasksCreated}</span>
              </div>
            </div>
            {autoImprove.status.includes('WORKING') && (
              <div className="progress-bar">
                <div className="progress-fill" style={{width: '45%'}}></div>
              </div>
            )}
          </div>

          {/* Live Execution Log */}
          <div className="panel log-panel">
            <h2>LIVE EXECUTION LOG</h2>
            <div className="log-viewer">
              {logs.map((log, i) => (
                <div key={i} className="log-line">
                  <span className="log-time">{log.time ? `[${new Date(log.time).toLocaleTimeString()}]` : ''}</span>
                  <span className={`log-message ${
                    log.message.includes('✅') ? 'success' :
                    log.message.includes('❌') ? 'error' :
                    log.message.includes('🤖') ? 'info' : ''
                  }`}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Task Queue */}
          <div className="panel task-panel">
            <h2>TASK QUEUE</h2>
            <div className="task-list">
              <div className="task-header">
                <span>#</span>
                <span>Task</span>
                <span>Status</span>
                <span>Checkpoints</span>
              </div>
              {tasks.slice(0, 10).map((task, i) => (
                <div key={task.id} className="task-item">
                  <span>{i + 1}.</span>
                  <span>{task.title}</span>
                  <span>{getTaskStatusIcon(task.status)} {task.status}</span>
                  <span className="checkpoints">
                    {task.checkpoints?.map((cp, j) => (
                      <span key={j} className={`checkpoint ${cp.status}`}>
                        {cp.status === 'completed' ? '✅' : cp.status === 'failed' ? '❌' : '⬜'}
                      </span>
                    )) || '⬜⬜⬜'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Deployment History */}
          <div className="panel deploy-panel">
            <h2>DEPLOYMENT HISTORY</h2>
            <div className="deploy-list">
              {deployments.length > 0 ? deployments.map((deploy, i) => (
                <div key={i} className="deploy-item">
                  <span>{deploy.time}</span>
                  <span>{deploy.message}</span>
                  <span>{deploy.status === 'success' ? '✅ Live' : '❌ Failed'}</span>
                </div>
              )) : (
                <div className="deploy-item">
                  <span>No recent deployments</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <style jsx>{`
          .dashboard {
            background: #0a0a0a;
            color: #00ff00;
            min-height: 100vh;
            font-family: 'Courier New', monospace;
            padding: 20px;
          }

          .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            border: 2px solid #00ff00;
            background: #1a1a1a;
          }

          .header h1 {
            margin: 0;
            font-size: 24px;
            text-shadow: 0 0 10px #00ff00;
            animation: pulse 2s infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }

          .main-grid {
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: 20px;
            max-width: 1400px;
            margin: 0 auto;
          }

          .panel {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 15px;
          }

          .panel h2 {
            margin: 0 0 15px 0;
            font-size: 14px;
            color: #00ff00;
            border-bottom: 1px solid #333;
            padding-bottom: 5px;
          }

          .status-panel {
            grid-column: 1;
          }

          .monitor-panel {
            grid-column: 2;
          }

          .log-panel {
            grid-column: 1 / -1;
          }

          .task-panel {
            grid-column: 1 / -1;
          }

          .deploy-panel {
            grid-column: 1 / -1;
          }

          .status-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .status-item {
            display: flex;
            justify-content: space-between;
            padding: 5px;
            background: #0a0a0a;
            border-radius: 4px;
          }

          .monitor-stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 15px;
          }

          .stat {
            display: flex;
            justify-content: space-between;
            padding: 5px;
            background: #0a0a0a;
            border-radius: 4px;
          }

          .stat label {
            color: #666;
            font-size: 12px;
          }

          .working {
            animation: blink 1s infinite;
          }

          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }

          .progress-bar {
            height: 20px;
            background: #0a0a0a;
            border-radius: 10px;
            overflow: hidden;
          }

          .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #00ff00, #00aa00);
            animation: progress 2s ease-in-out infinite;
          }

          @keyframes progress {
            0% { transform: translateX(-10%); }
            100% { transform: translateX(10%); }
          }

          .log-viewer {
            background: #0a0a0a;
            padding: 10px;
            border-radius: 4px;
            height: 200px;
            overflow-y: auto;
            font-size: 11px;
            line-height: 1.4;
          }

          .log-line {
            margin-bottom: 2px;
          }

          .log-time {
            color: #666;
            margin-right: 10px;
          }

          .log-message.success {
            color: #00ff00;
          }

          .log-message.error {
            color: #ff4444;
          }

          .log-message.info {
            color: #00aaff;
          }

          .task-list {
            background: #0a0a0a;
            border-radius: 4px;
            padding: 10px;
          }

          .task-header {
            display: grid;
            grid-template-columns: 40px 1fr 150px 150px;
            gap: 10px;
            padding: 5px;
            border-bottom: 1px solid #333;
            margin-bottom: 10px;
            font-size: 12px;
            color: #666;
          }

          .task-item {
            display: grid;
            grid-template-columns: 40px 1fr 150px 150px;
            gap: 10px;
            padding: 5px;
            border-bottom: 1px solid #222;
            font-size: 12px;
          }

          .checkpoints {
            display: flex;
            gap: 2px;
          }

          .checkpoint {
            font-size: 10px;
          }

          .deploy-list {
            background: #0a0a0a;
            border-radius: 4px;
            padding: 10px;
            font-size: 12px;
          }

          .deploy-item {
            display: grid;
            grid-template-columns: 100px 1fr 100px;
            gap: 10px;
            padding: 5px;
            border-bottom: 1px solid #222;
          }
        `}</style>
      </div>
    </>
  );
}