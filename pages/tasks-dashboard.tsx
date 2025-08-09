import React, { useState, useEffect } from 'react';
import { TaskCardWithTerminal } from '../src/components/TaskCardWithTerminal';

export default function TasksDashboard() {
  const [tasks, setTasks] = useState([
    {
      id: '1',
      name: 'Document Management System for Uncle Frank\'s Sacred Flow',
      description: 'Build a real, working document management system that enforces the sacred development flow with actual version control, validation, and state tracking.',
      status: 'In Progress',
      sessionId: '5ae5229a-a9be-464e-9a99-4a88a4a18541',
      issueNumber: '74',
      checkpoints: [
        {
          name: 'Core API Structure',
          objective: 'Create the foundational API structure for document management'
        },
        {
          name: 'Validation System with Claude Integration',
          objective: 'Implement comprehensive validation system that integrates with Claude'
        },
        {
          name: 'Task Generation and GitHub Integration',
          objective: 'Create task generation from drafts with GitHub issue creation'
        },
        {
          name: 'Flow Enforcement and Merge Control',
          objective: 'Implement strict flow enforcement and merge request system'
        },
        {
          name: 'Testing and Integration Verification',
          objective: 'Comprehensive testing of the complete sacred flow'
        }
      ]
    }
  ]);

  const handleExecute = (taskId: string) => {
    console.log('Executing task:', taskId);
    // Add your execution logic here
  };

  const handleRestart = (taskId: string) => {
    console.log('Restarting task:', taskId);
    // Add your restart logic here
  };

  return (
    <div style={{
      background: '#0f1419',
      minHeight: '100vh',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        background: '#1e2936',
        color: 'white',
        padding: '20px 30px',
        borderRadius: '8px',
        marginBottom: '30px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px' }}>Tasks Dashboard</h1>
          <p style={{ margin: '5px 0 0 0', color: '#8899a6' }}>
            Manage all your Claude tasks in one place
          </p>
        </div>
        <button style={{
          background: '#28a745',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer'
        }}>
          Create New Task
        </button>
      </div>

      {/* Tasks Container */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Active Tasks */}
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ 
            color: '#e1e8ed', 
            fontSize: '20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span>🚀</span>
            Active Tasks
          </h2>
          
          {tasks.map(task => (
            <TaskCardWithTerminal
              key={task.id}
              task={task}
              onExecute={() => handleExecute(task.id)}
              onRestart={() => handleRestart(task.id)}
            />
          ))}
        </div>

        {/* You can add more sections here like Completed Tasks, Failed Tasks, etc. */}
      </div>
    </div>
  );
}