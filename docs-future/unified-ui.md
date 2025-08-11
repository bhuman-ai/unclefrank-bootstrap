# Unified Dashboard UI Specification

## Overview
ONE single page application that shows everything happening in the Uncle Frank system.

## URL Structure
- `/` - Main dashboard (everything in one place)
- No other pages needed

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 UNCLE FRANK AUTONOMOUS DEVELOPMENT PLATFORM             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────────────┐│
│  │   SYSTEM STATUS      │  │   AUTO-IMPROVE MONITOR       ││
│  │                      │  │                              ││
│  │  Claude: ✅ Connected│  │  Iteration: #47              ││
│  │  GitHub: ✅ Synced   │  │  Status: CLAUDE WORKING      ││
│  │  Vercel: ✅ Deployed │  │  Current: Creating login API ││
│  │  Queue:  12 tasks    │  │  Gaps Found: 23              ││
│  │                      │  │  Tasks Created: 12           ││
│  └──────────────────────┘  │  Progress: ████████░░ 78%    ││
│                             └──────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┤
│  │  LIVE EXECUTION LOG                              [AUTO]  │
│  ├──────────────────────────────────────────────────────────┤
│  │  [00:23:15] 📚 Reading docs-future/...                   │
│  │  [00:23:16] 🔍 Found gap: missing /api/auth/login        │
│  │  [00:23:17] ✅ Created Task-847: Implement login API     │
│  │  [00:23:18] 🤖 Claude executing checkpoint CP-001...     │
│  │  [00:23:45] ✅ Created file: pages/api/auth/login.js     │
│  │  [00:23:46] 📤 Pushing to GitHub...                      │
│  │  [00:23:48] 🚀 Vercel deployment started                 │
│  └──────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────────┤
│  │  TASK QUEUE                                    [MANUAL]  │
│  ├──────────────────────────────────────────────────────────┤
│  │  #  Task                     Status      Checkpoints     │
│  │  ──────────────────────────────────────────────────────  │
│  │  1. Implement login API      🔄 RUNNING   [✅][✅][🔄][] │
│  │  2. Add user dashboard       ⏸️ QUEUED    [][][][]      │
│  │  3. Create settings page     ⏸️ QUEUED    [][][]        │
│  │  4. Add OAuth integration    ⏸️ QUEUED    [][][][][][]  │
│  │  ──────────────────────────────────────────────────────  │
│  │  847. Fix validation bug     ✅ COMPLETE  [✅][✅][✅]   │
│  │  846. Update API docs        ✅ COMPLETE  [✅][✅]       │
│  └──────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────────┤
│  │  DEPLOYMENT HISTORY                                      │
│  ├──────────────────────────────────────────────────────────┤
│  │  5 min ago  - feat: Add login API     ✅ Live           │
│  │  23 min ago - fix: Validation bug     ✅ Live           │
│  │  1 hr ago   - feat: User dashboard    ✅ Live           │
│  └──────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. Real-Time Updates
- WebSocket connection for live updates
- No page refresh needed
- Smooth animations for state changes

### 2. Color Coding
- 🟢 Green: Success/Complete
- 🟡 Yellow: In Progress
- 🔴 Red: Failed/Error
- ⚫ Gray: Queued/Pending

### 3. Interactive Elements
- Click any task to see details
- Click checkpoint to see pass/fail criteria
- Click deployment to open Vercel preview
- Drag tasks to reorder priority

### 4. Auto-Improve Monitor Shows
- Current iteration number
- What Claude is currently doing (with spinner)
- Number of gaps found
- Number of tasks created
- Progress bar for current task
- Time elapsed (no timeout!)

### 5. Task Queue Shows
- All tasks (both auto-created and manual)
- Visual checkpoint progress
- Current status with emoji indicators
- Recently completed tasks at bottom

### 6. Execution Log
- Scrolling log of all system activity
- Color-coded by type (info/success/error)
- Timestamps for everything
- Auto-scroll to bottom (toggleable)

## Technical Implementation

### Frontend (React/Next.js)
```jsx
// pages/index.js
import { useState, useEffect } from 'react'
import useWebSocket from 'react-use-websocket'

export default function Dashboard() {
  const [systemStatus, setSystemStatus] = useState({})
  const [tasks, setTasks] = useState([])
  const [logs, setLogs] = useState([])
  const [autoImprove, setAutoImprove] = useState({})
  
  const { lastMessage } = useWebSocket('/api/monitor/stream')
  
  useEffect(() => {
    if (lastMessage) {
      const data = JSON.parse(lastMessage.data)
      // Update appropriate state based on message type
    }
  }, [lastMessage])
  
  return (
    <div className="dashboard">
      <SystemStatus data={systemStatus} />
      <AutoImproveMonitor data={autoImprove} />
      <ExecutionLog logs={logs} />
      <TaskQueue tasks={tasks} />
      <DeploymentHistory />
    </div>
  )
}
```

### Backend Updates Needed
1. WebSocket endpoint for real-time updates
2. Unified status endpoint combining all system info
3. Task queue management with priorities
4. Log aggregation from all services

### Responsive Design
- Works on desktop (primary)
- Tablet friendly
- Mobile: Stack components vertically

## User Interactions

### Creating Manual Tasks
- "+" button in Task Queue header
- Modal with title, description, priority
- Auto-creates checkpoints after submission

### Monitoring Auto-Improve
- Play/Pause button to control execution
- Clear logs button
- Export logs button
- Iteration history dropdown

### Emergency Controls
- Red "STOP ALL" button
- Rollback last deployment
- Clear task queue
- Reset system state