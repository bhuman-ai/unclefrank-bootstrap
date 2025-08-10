import { useState, useEffect } from 'react';

export default function AutoImproveMonitor() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [autoScroll, setAutoScroll] = useState(true);

    const refreshStatus = async () => {
        try {
            const response = await fetch('/api/auto-improve/status');
            const data = await response.json();
            setStatus(data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching status:', error);
            setLoading(false);
        }
    };

    const startSystem = async () => {
        if (confirm('Start the auto-improve system?')) {
            try {
                const response = await fetch('/api/auto-improve/start', {
                    method: 'POST'
                });
                const data = await response.json();
                
                if (data.success) {
                    alert(`✅ System started! PID: ${data.pid}`);
                    refreshStatus();
                } else {
                    alert(`❌ Failed to start: ${data.error}`);
                }
            } catch (error) {
                alert(`❌ Error: ${error.message}`);
            }
        }
    };

    const stopSystem = async () => {
        if (confirm('Stop the auto-improve system?')) {
            try {
                const response = await fetch('/api/auto-improve/stop', {
                    method: 'POST'
                });
                const data = await response.json();
                
                if (data.success) {
                    alert('✅ System stopped!');
                    refreshStatus();
                } else {
                    alert(`❌ Failed to stop: ${data.error}`);
                }
            } catch (error) {
                alert(`❌ Error: ${error.message}`);
            }
        }
    };

    useEffect(() => {
        refreshStatus();
        const interval = setInterval(refreshStatus, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (autoScroll && status?.logs) {
            const logsElement = document.getElementById('logsViewer');
            if (logsElement) {
                logsElement.scrollTop = logsElement.scrollHeight;
            }
        }
    }, [status?.logs, autoScroll]);

    return (
        <div style={styles.container}>
            <style jsx global>{`
                body {
                    margin: 0;
                    padding: 0;
                    background: #0a0a0a;
                    font-family: 'Courier New', monospace;
                }
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }
            `}</style>

            <h1 style={styles.title}>🤖 Uncle Frank Auto-Improve Monitor</h1>
            
            <div style={styles.statusBar}>
                <div style={styles.statusIndicator}>
                    <div style={{
                        ...styles.statusDot,
                        backgroundColor: status?.running ? '#00ff00' : '#ff4444',
                        boxShadow: status?.running ? '0 0 10px #00ff00' : '0 0 10px #ff4444',
                        animation: 'pulse 2s infinite'
                    }}></div>
                    <span style={{
                        ...styles.statusText,
                        color: status?.running ? '#00ff00' : '#ff4444'
                    }}>
                        {loading ? 'Checking status...' : status?.running ? '✅ System Running' : '❌ System Stopped'}
                    </span>
                    <span style={styles.timestamp}>
                        Last checked: {new Date().toLocaleTimeString()}
                    </span>
                </div>
                
                <div style={styles.controls}>
                    <button 
                        style={styles.button} 
                        onClick={startSystem}
                        disabled={status?.running}
                    >
                        🚀 Start System
                    </button>
                    <button 
                        style={styles.button} 
                        onClick={stopSystem}
                        disabled={!status?.running}
                    >
                        ⏹️ Stop System
                    </button>
                    <button style={styles.button} onClick={refreshStatus}>
                        🔄 Refresh
                    </button>
                </div>
            </div>
            
            <div style={styles.panels}>
                <div style={styles.panel}>
                    <h2 style={styles.panelTitle}>📋 System Logs (Live Stream)</h2>
                    <div id="logsViewer" style={styles.logViewer}>
                        <pre style={styles.pre}>
                            {status?.logs || 'Waiting for logs...'}
                        </pre>
                    </div>
                    <div style={styles.autoScrollToggle}>
                        <input 
                            type="checkbox" 
                            id="autoScroll" 
                            checked={autoScroll}
                            onChange={(e) => setAutoScroll(e.target.checked)}
                            style={styles.checkbox}
                        />
                        <label htmlFor="autoScroll" style={styles.label}>
                            Auto-scroll to bottom
                        </label>
                    </div>
                </div>
                
                <div style={styles.panel}>
                    <h2 style={styles.panelTitle}>📁 Git Changes</h2>
                    <div style={styles.logViewer}>
                        <pre style={styles.pre}>
                            {status?.gitChanges || 'No changes detected yet...'}
                        </pre>
                    </div>
                    
                    <h2 style={{...styles.panelTitle, marginTop: '20px'}}>
                        🖥️ Process Info
                    </h2>
                    <div style={styles.logViewer}>
                        <pre style={styles.pre}>
                            {status?.processes || 'No processes running...'}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        padding: '20px',
        maxWidth: '1400px',
        margin: '0 auto',
        color: '#00ff00'
    },
    title: {
        color: '#ff6b6b',
        marginBottom: '20px',
        textShadow: '0 0 10px #ff6b6b',
        fontSize: '28px'
    },
    statusBar: {
        background: '#1a1a1a',
        border: '2px solid #00ff00',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    statusIndicator: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    statusDot: {
        width: '20px',
        height: '20px',
        borderRadius: '50%'
    },
    statusText: {
        fontSize: '16px'
    },
    timestamp: {
        color: '#666',
        fontSize: '12px'
    },
    controls: {
        display: 'flex',
        gap: '10px'
    },
    button: {
        background: '#1a1a1a',
        color: '#00ff00',
        border: '2px solid #00ff00',
        padding: '10px 20px',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'all 0.3s'
    },
    panels: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        marginTop: '20px'
    },
    panel: {
        background: '#1a1a1a',
        border: '2px solid #333',
        borderRadius: '8px',
        padding: '15px',
        minHeight: '400px'
    },
    panelTitle: {
        color: '#00ff00',
        marginBottom: '15px',
        fontSize: '18px',
        borderBottom: '1px solid #333',
        paddingBottom: '10px'
    },
    logViewer: {
        background: '#0a0a0a',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px',
        lineHeight: '1.5',
        maxHeight: '500px',
        overflowY: 'auto',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word'
    },
    pre: {
        margin: 0,
        color: '#00ff00',
        fontFamily: 'Courier New, monospace'
    },
    autoScrollToggle: {
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        marginTop: '10px'
    },
    checkbox: {
        width: '20px',
        height: '20px'
    },
    label: {
        color: '#00ff00'
    }
};