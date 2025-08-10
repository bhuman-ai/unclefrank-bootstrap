# Interface.md — Current UI Implementation

## Live Production UI

### 1. Main Task Dashboard (index.html)
**URL**: https://unclefrank-bootstrap.vercel.app

#### Working Features ✅
- **Task Input**: Textarea for entering task description
- **Execute Button**: Sends task to Claude on Fly.io
- **Status Display**: Shows current task status
- **Terminal Output**: Real-time streaming from Claude
- **Refresh Button**: Updates status from Claude sessions
- **Vercel Preview**: Shows preview URL when available
- **Approve Button**: Merges PR to main

#### UI Elements
```
┌─────────────────────────────────────────┐
│  Uncle Frank's Task Executor            │
├─────────────────────────────────────────┤
│  📋 Active Task                         │
│  ┌─────────────────────────────────┐   │
│  │ Task description text area       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Execute Checkpoints] [Refresh]       │
│                                         │
│  Status: [In Progress/Ready/Complete]  │
│                                         │
│  Terminal Output:                      │
│  ┌─────────────────────────────────┐   │
│  │ > Claude output streaming here   │   │
│  │ > Real-time updates              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Open Vercel Preview →]               │
│  [Approve Task ✓]                      │
└─────────────────────────────────────────┘
```

#### Current Styling
- Dark theme with purple accents
- Monospace font for terminal output
- Responsive layout (works on mobile)
- Loading states with spinners

### 2. Frank Chat Interface (frank-chat.html)
**URL**: /frank-chat.html

#### Working Features ✅
- **Chat Input**: Message textarea with auto-resize
- **Send Button**: Sends to Frank API
- **Message Display**: Chat bubbles with timestamps
- **Quick Actions**: Preset command buttons
- **Status Indicator**: Shows Frank online/offline
- **Typing Indicator**: Animated dots while waiting

#### UI Layout
```
┌─────────────────────────────────────────┐
│  🎯 Frank | Meta Agent | Online         │
├─────────────────────────────────────────┤
│  [Check Server][Fix Error][Deploy]...   │
├─────────────────────────────────────────┤
│  Frank: Yo, what needs fixing?         │
│                                         │
│                    User: Check status   │
│                                         │
│  Frank: Server's up, no issues...      │
│                                         │
│  ⋯⋯⋯ (typing indicator)                │
├─────────────────────────────────────────┤
│  [Type message...            ] [Send]  │
└─────────────────────────────────────────┘
```

#### Mobile Optimizations
- Full viewport height
- Touch-friendly buttons
- Keyboard-aware input
- Swipe gestures (planned)

## What's NOT Implemented

### Planned But Not Built
1. **Task Queue View** - List of pending tasks
2. **Task Instance Dashboard** - Monitor running instances
3. **Project Workspace** - Edit Project.md drafts
4. **Checkpoint Progress** - Visual checkpoint tracking
5. **Global Logs Viewer** - Centralized log search
6. **Validation Dashboard** - Show validation results
7. **Dependency Graph** - Visual task dependencies
8. **Slash Commands** - Quick action triggers
9. **Brainstorm Mode** - Ideation interface

### UI Components That Exist But Don't Work
1. **GitHub Sync** - Button exists but not wired
2. **Settings** - No settings panel yet
3. **User Auth** - No login system
4. **Task History** - No persistence of past tasks

## Current Tech Stack

### Frontend
- **HTML**: Static files in `/public/`
- **CSS**: Inline styles (no framework)
- **JavaScript**: Vanilla JS (no React/Vue)
- **Icons**: Unicode emojis only

### No Build Process
- Direct HTML/JS files
- No bundling or transpilation
- No npm packages for frontend
- Assets served by Vercel

## API Integration (Frontend)

### Working API Calls
```javascript
// Create Claude Session
fetch('https://uncle-frank-claude.fly.dev/api/sessions', {
  method: 'POST',
  body: JSON.stringify({ testOnly: false })
})

// Execute Task
fetch(`https://uncle-frank-claude.fly.dev/api/sessions/${id}/execute`, {
  method: 'POST', 
  body: JSON.stringify({ message: taskText })
})

// Get Status
fetch(`https://uncle-frank-claude.fly.dev/api/sessions/${id}/status`)

// Stream Terminal
fetch(`https://uncle-frank-claude.fly.dev/api/sessions/${id}/terminal`)

// GitHub Operations
fetch('/api/github?action=update-issue-status', {
  method: 'POST',
  body: JSON.stringify({ issueNumber, status })
})

// Approve Task
fetch('/api/approve-task', {
  method: 'POST',
  body: JSON.stringify({ issueNumber, prNumber })
})
```

## User Flows (Current)

### Task Execution Flow
1. User enters task description
2. Clicks "Execute Checkpoints"
3. System creates GitHub issue
4. Creates Claude session on Fly.io
5. Shows real-time terminal output
6. User clicks "Refresh" to check status
7. When ready, Vercel preview URL appears
8. User reviews preview
9. Clicks "Approve" to merge

### Frank Chat Flow
1. User opens /frank-chat.html
2. Types question or command
3. Frank responds with advice
4. User can use quick actions
5. Conversation continues

## Responsive Design

### Current Breakpoints
- Desktop: > 768px (full layout)
- Mobile: < 768px (stacked layout)

### Mobile Adjustments
- Buttons stack vertically
- Terminal output reduces height
- Font sizes scale down
- Touch targets increase

## Accessibility (Limited)

### What Works
- Semantic HTML elements
- Button labels
- High contrast colors
- Keyboard navigation (basic)

### What's Missing
- ARIA labels
- Screen reader support
- Skip navigation
- Focus indicators
- Alt text for status icons

## Browser Support

### Tested On
- Chrome 120+ ✅
- Safari 17+ ✅
- Firefox 121+ ✅
- Mobile Safari ✅
- Chrome Mobile ✅

### Known Issues
- Edge: Terminal output scrolling
- Safari: Textarea auto-resize glitchy
- Firefox: Emoji rendering varies

## Performance

### Current Metrics
- Initial Load: ~2 seconds
- Time to Interactive: ~1 second
- Terminal Update: 5 second polling
- API Response: 1-3 seconds average

### Bottlenecks
- No caching
- Polling instead of websockets
- Full page refreshes
- Large terminal outputs slow

---

*This document reflects the current UI implementation.*
*Planned UI improvements are in `/docs to work towards/interface.md`*