// FRANK'S TASK ORCHESTRATOR - THE BRAIN THAT CONTROLS ALL TERRAGON INSTANCES
// No hard rules, just intelligent decisions based on context

import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const TERRAGON_AUTH = process.env.TERRAGON_AUTH;
if (!TERRAGON_AUTH) {
  console.error('[Orchestrator] TERRAGON_AUTH not configured');
  throw new Error('TERRAGON_AUTH environment variable required');
}

// FRANK'S RATE LIMITING
const rateLimiter = {
  requests: new Map(),
  windowMs: 60000, // 1 minute
  maxRequests: 30, // 30 requests per minute
  
  check(key) {
    const now = Date.now();
    const userRequests = this.requests.get(key) || [];
    const recentRequests = userRequests.filter(time => now - time < this.windowMs);
    
    if (recentRequests.length >= this.maxRequests) {
      return false; // Rate limited
    }
    
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    return true;
  }
};

class TaskOrchestrator {
  constructor() {
    this.baseUrl = 'https://www.terragonlabs.com';
    this.deploymentId = 'dpl_3hWzkM7LiymSczFN21Z8chju84CV';
    this.anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });
    this.startTime = Date.now();
    
    // Track all active instances and their relationships
    this.instances = new Map();
    this.messageStreams = new Map();
    this.decisionHistory = [];
    
    // FRANK'S LIMITS: Prevent resource exhaustion
    this.MAX_INSTANCES = parseInt(process.env.ORCHESTRATOR_MAX_INSTANCES || '50');
    this.MAX_DECISIONS_PER_INSTANCE = parseInt(process.env.ORCHESTRATOR_MAX_DECISIONS_PER_INSTANCE || '10');
    this.MAX_CONTEXT_LENGTH = 10000; // chars
    this.DECISION_COOLDOWN_MS = 30000; // 30s between decisions
    this.INSTANCE_TTL_MS = 3600000; // 1 hour
    this.lastDecisionTime = new Map();
    
    // Start cleanup timer
    this.startCleanupTimer();
  }
  
  // FRANK'S CLEANUP: Prevent zombie instances
  startCleanupTimer() {
    setInterval(() => {
      const now = Date.now();
      const toDelete = [];
      
      for (const [id, instance] of this.instances) {
        // Remove instances older than TTL with no recent activity
        if (now - instance.lastActivity > this.INSTANCE_TTL_MS) {
          toDelete.push(id);
        }
        
        // Remove completed/failed instances after 10 minutes
        if ((instance.status === 'completed' || instance.status === 'failed' || instance.status === 'error') 
            && now - instance.lastActivity > 600000) {
          toDelete.push(id);
        }
      }
      
      for (const id of toDelete) {
        console.log(`[Orchestrator] Cleaning up stale instance: ${id}`);
        this.instances.delete(id);
        this.lastDecisionTime.delete(id);
      }
      
      if (toDelete.length > 0) {
        console.log(`[Orchestrator] Cleaned up ${toDelete.length} stale instances`);
      }
    }, 60000); // Run every minute
  }

  // Register a new Terragon instance to monitor
  registerInstance(instanceId, metadata) {
    // FRANK'S LIMIT: Prevent instance explosion
    if (this.instances.size >= this.MAX_INSTANCES) {
      console.error(`[Orchestrator] MAX_INSTANCES limit reached (${this.MAX_INSTANCES})`);
      throw new Error('Instance limit exceeded');
    }
    
    // FRANK'S VALIDATION: Sanitize metadata
    const sanitizedMetadata = {
      type: String(metadata.type || 'unknown').substring(0, 50),
      parentId: metadata.parentId ? String(metadata.parentId).substring(0, 100) : null,
      checkpoint: metadata.checkpoint ? {
        id: String(metadata.checkpoint.id || '').substring(0, 50),
        name: String(metadata.checkpoint.name || '').substring(0, 200)
      } : null,
      branch: String(metadata.branch || 'master').substring(0, 100)
    };
    
    this.instances.set(instanceId, {
      id: instanceId,
      type: sanitizedMetadata.type,
      parentId: sanitizedMetadata.parentId,
      checkpoint: sanitizedMetadata.checkpoint,
      branch: sanitizedMetadata.branch,
      status: 'active',
      messages: [],
      decisionCount: 0, // Track decisions per instance
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metadata: sanitizedMetadata
    });
    
    console.log(`[Orchestrator] Registered ${sanitizedMetadata.type} instance: ${instanceId}`);
  }

  // Stream messages from all instances
  async streamMessages(instanceId) {
    const instance = this.instances.get(instanceId);
    if (!instance) return;
    
    console.log(`[Orchestrator] 🔄 Checking ${instanceId} (${instance.type})...`);
    
    try {
      const response = await fetch(
        `${this.baseUrl}/task/${instanceId}`,
        {
          method: 'POST',
          headers: {
            'accept': 'text/x-component',
            'content-type': 'text/plain;charset=UTF-8',
            'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
            'next-action': '7f40cb55e87cce4b3543b51a374228296bc2436c6d',
            'origin': this.baseUrl,
            'referer': `${this.baseUrl}/task/${instanceId}`,
            'user-agent': 'Mozilla/5.0',
            'x-deployment-id': this.deploymentId
          },
          body: JSON.stringify([instanceId])
        }
      );

      const content = await response.text();
      
      // Extract messages and status
      const messages = this.extractMessages(content);
      const status = this.extractStatus(content);
      
      // Check for changes
      const hasNewMessages = messages.length > instance.messages.length;
      const statusChanged = status !== instance.status;
      
      // Update instance state
      instance.messages = messages;
      instance.status = status;
      instance.lastActivity = Date.now();
      
      if (hasNewMessages || statusChanged) {
        console.log(`[Orchestrator] 📢 Changes detected in ${instanceId}:`);
        if (hasNewMessages) console.log(`[Orchestrator]   - New messages: ${messages.length - instance.messages.length}`);
        if (statusChanged) console.log(`[Orchestrator]   - Status changed: ${instance.status} → ${status}`);
        
        // Trigger decision making if needed
        await this.analyzeAndDecide(instanceId);
      }
      
    } catch (error) {
      console.error(`[Orchestrator] Error streaming from ${instanceId}:`, error);
    }
  }

  // Extract messages from Terragon response
  extractMessages(content) {
    const messages = [];
    const messageMatches = [...content.matchAll(/"text":"((?:[^"\\]|\\.)*)"/g)];
    
    for (const match of messageMatches) {
      messages.push({
        text: match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
        timestamp: Date.now()
      });
    }
    
    return messages;
  }

  // Extract status from Terragon response
  extractStatus(content) {
    const statusMatch = content.match(/"status":"([^"]+)"/);
    return statusMatch ? statusMatch[1] : 'unknown';
  }

  // Core decision-making logic
  async analyzeAndDecide(instanceId) {
    const instance = this.instances.get(instanceId);
    if (!instance) return;
    
    console.log(`\n[Orchestrator] 🧠 THINKING about instance ${instanceId} (${instance.type})`);
    console.log(`[Orchestrator] 📊 Current status: ${instance.status}`);
    console.log(`[Orchestrator] 📈 Decision count: ${instance.decisionCount}/${this.MAX_DECISIONS_PER_INSTANCE}`);
    
    // FRANK'S COOLDOWN: Prevent decision thrashing
    const lastDecision = this.lastDecisionTime.get(instanceId) || 0;
    const timeSinceLastDecision = Date.now() - lastDecision;
    if (timeSinceLastDecision < this.DECISION_COOLDOWN_MS) {
      console.log(`[Orchestrator] ⏳ WAITING: Cooldown active (${Math.round((this.DECISION_COOLDOWN_MS - timeSinceLastDecision) / 1000)}s remaining)`);
      return;
    }
    
    // FRANK'S LIMIT: Prevent infinite decisions
    if (instance.decisionCount >= this.MAX_DECISIONS_PER_INSTANCE) {
      console.error(`[Orchestrator] MAX_DECISIONS limit reached for ${instanceId}`);
      await this.escalateToHuman({
        reason: 'Instance exceeded decision limit',
        context: { instanceId, decisionCount: instance.decisionCount }
      });
      return;
    }
    
    // Build context for the LLM
    console.log(`[Orchestrator] 🔍 ANALYZING: Building context...`);
    const context = this.buildContext(instanceId);
    
    // Log what we're seeing
    if (context.hasRepeatingPattern) {
      console.log(`[Orchestrator] ⚠️ PATTERN DETECTED: Decision loop identified!`);
    }
    
    const relatedCount = context.relatedInstances?.length || 0;
    console.log(`[Orchestrator] 🔗 Related instances: ${relatedCount}`);
    
    if (instance.messages.length > 0) {
      console.log(`[Orchestrator] 💬 Latest message: "${instance.messages[instance.messages.length - 1]?.text?.substring(0, 100)}..."`);
    }
    
    // FRANK'S CONTEXT LIMIT: Prevent token explosion
    const contextString = JSON.stringify(context);
    if (contextString.length > this.MAX_CONTEXT_LENGTH) {
      console.warn(`[Orchestrator] 📏 TRIMMING: Context too large (${contextString.length} chars)`);
      // Truncate messages to fit
      instance.messages = instance.messages.slice(-5);
    }
    
    try {
      console.log(`[Orchestrator] 🤔 CONSULTING: Asking Claude for decision...`);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000, // FRANK'S LIMIT: Smaller responses
        messages: [{
          role: 'user',
          content: `You are Uncle Frank's Task Orchestrator, monitoring multiple Terragon instances.

Current Instance: ${instanceId} (${instance.type})
Status: ${instance.status}
Decision Count: ${instance.decisionCount}/${this.MAX_DECISIONS_PER_INSTANCE}
Latest Messages: ${JSON.stringify(instance.messages.slice(-3), null, 2)}

Active Instances: ${this.instances.size}/${this.MAX_INSTANCES}

IMPORTANT CONSTRAINTS:
- Do NOT create instances if near limit
- Do NOT make decisions in rapid succession
- PREFER 'wait' action when uncertain
- ESCALATE early if no clear path forward

Analyze the current situation and decide what actions to take. You can:
1. Send messages to any instance
2. Create new instances (test, resolver, etc.)
3. Mark instances as complete
4. Escalate to human
5. Wait for more information

Consider:
- Has the main task made progress?
- Are tests passing or failing?
- Do we need to retry or fix something?
- Should we create a resolver instance?
- Is human intervention needed?

Respond with a JSON decision:
{
  "action": "send_message|create_instance|mark_complete|escalate|wait",
  "targetInstance": "instance-id",
  "details": {
    // Action-specific details
  },
  "reasoning": "Why this decision?"
}`
        }]
      });
      
      // FRANK'S SAFE JSON PARSING
      let decision;
      try {
        const rawDecision = response.content[0].text;
        console.log(`[Orchestrator] 📝 RAW RESPONSE: ${rawDecision.substring(0, 200)}...`);
        
        // Remove any potential code execution attempts
        const sanitized = rawDecision.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        decision = JSON.parse(sanitized);
        
        console.log(`[Orchestrator] 🎯 DECISION: ${decision.action}`);
        console.log(`[Orchestrator] 💭 REASONING: ${decision.reasoning}`);
      } catch (parseError) {
        console.error('[Orchestrator] ❌ PARSE ERROR:', parseError.message);
        // Default to safe wait action
        decision = { action: 'wait', reasoning: 'Failed to parse LLM response' };
      }
      
      // FRANK'S VALIDATION: Sanitize decision
      const allowedActions = ['send_message', 'create_instance', 'mark_complete', 'escalate', 'wait'];
      if (!decision.action || typeof decision.action !== 'string' || !allowedActions.includes(decision.action)) {
        console.warn(`[Orchestrator] Invalid action: ${decision.action}`);
        decision = { action: 'wait', reasoning: 'Invalid action requested' };
      }
      
      // Update counters
      instance.decisionCount++;
      this.lastDecisionTime.set(instanceId, Date.now());
      
      console.log(`[Orchestrator] 🚀 EXECUTING: ${decision.action} action...`);
      await this.executeDecision(decision);
      
    } catch (error) {
      console.error('[Orchestrator] 🚨 ERROR in decision-making:', error.message);
      // Don't let errors cascade
      instance.status = 'error';
    }
    
    console.log(`[Orchestrator] ✅ DONE: Finished thinking about ${instanceId}\n`);
  }

  // Build comprehensive context
  buildContext(instanceId) {
    const instance = this.instances.get(instanceId);
    const relatedInstances = this.getRelatedInstances(instanceId);
    
    // FRANK'S LOOP DETECTION
    const recentDecisions = this.decisionHistory
      .filter(d => d.targetInstance === instanceId)
      .slice(-5);
    
    const hasRepeatingPattern = this.detectDecisionLoop(recentDecisions);
    
    return {
      currentInstance: instance,
      relatedInstances: relatedInstances.slice(0, 5), // Limit related instances
      hasRepeatingPattern,
      checkpointStatus: this.getCheckpointStatus(instance),
      testResults: this.getTestResults(instanceId)
    };
  }
  
  // FRANK'S LOOP DETECTION
  detectDecisionLoop(decisions) {
    if (decisions.length < 3) return false;
    
    // Check for repeating actions
    const actions = decisions.map(d => d.action);
    const lastTwo = actions.slice(-2).join(',');
    const previousTwo = actions.slice(-4, -2).join(',');
    
    return lastTwo === previousTwo;
  }

  // Execute the LLM's decision
  async executeDecision(decision) {
    // FRANK'S HISTORY LIMIT: Prevent memory leak
    if (this.decisionHistory.length > 100) {
      this.decisionHistory = this.decisionHistory.slice(-50);
    }
    
    this.decisionHistory.push({
      ...decision,
      timestamp: Date.now(),
      targetInstance: decision.targetInstance
    });
    
    console.log(`[Orchestrator] ⚡ ACTION DETAILS:`);
    console.log(`[Orchestrator]   - Action: ${decision.action}`);
    console.log(`[Orchestrator]   - Target: ${decision.targetInstance || 'N/A'}`);
    console.log(`[Orchestrator]   - Reason: ${decision.reasoning}`);
    if (decision.details) {
      console.log(`[Orchestrator]   - Details:`, JSON.stringify(decision.details, null, 2));
    }
    
    switch (decision.action) {
      case 'send_message':
        console.log(`[Orchestrator] 📤 SENDING MESSAGE to ${decision.targetInstance}`);
        console.log(`[Orchestrator]   Message: "${decision.details.message.substring(0, 100)}..."`);
        await this.sendMessage(decision.targetInstance, decision.details.message);
        console.log(`[Orchestrator] ✅ Message sent successfully`);
        break;
        
      case 'create_instance':
        console.log(`[Orchestrator] 🏗️ CREATING new ${decision.details.metadata?.type || 'unknown'} instance`);
        await this.createInstance(decision.details);
        console.log(`[Orchestrator] ✅ Instance created successfully`);
        break;
        
      case 'mark_complete':
        console.log(`[Orchestrator] ✅ MARKING ${decision.targetInstance} as complete`);
        await this.markComplete(decision.targetInstance);
        break;
        
      case 'escalate':
        console.log(`[Orchestrator] 🚨 ESCALATING to human!`);
        await this.escalateToHuman(decision.details);
        break;
        
      case 'wait':
        console.log(`[Orchestrator] ⏸️ WAITING for more data...`);
        console.log(`[Orchestrator]   Reason: ${decision.reasoning}`);
        break;
    }
  }

  // Send message to a Terragon instance
  async sendMessage(instanceId, message) {
    const payload = [{
      threadId: instanceId,
      message: {
        type: 'user',
        model: 'sonnet',
        parts: [{
          type: 'rich-text',
          nodes: [{
            type: 'text',
            text: message
          }]
        }],
        timestamp: new Date().toISOString()
      }
    }];

    await fetch(
      `${this.baseUrl}/task/${instanceId}`,
      {
        method: 'POST',
        headers: {
          'accept': 'text/x-component',
          'content-type': 'text/plain;charset=UTF-8',
          'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
          'next-action': '7f40cb55e87cce4b3543b51a374228296bc2436c6d',
          'origin': this.baseUrl,
          'referer': `${this.baseUrl}/task/${instanceId}`,
          'user-agent': 'Mozilla/5.0',
          'x-deployment-id': this.deploymentId
        },
        body: JSON.stringify(payload)
      }
    );
  }

  // Create a new Terragon instance
  async createInstance(details) {
    // FRANK'S GUARD: Check instance limit
    if (this.instances.size >= this.MAX_INSTANCES) {
      console.error('[Orchestrator] Cannot create instance - limit reached');
      throw new Error('Instance limit exceeded');
    }
    const payload = [{
      message: {
        type: 'user',
        model: 'sonnet',
        parts: [{
          type: 'rich-text',
          nodes: [{
            type: 'text',
            text: details.initialMessage
          }]
        }],
        timestamp: new Date().toISOString()
      },
      githubRepoFullName: details.repo || 'bhuman-ai/unclefrank-bootstrap',
      repoBaseBranchName: details.branch || 'master',
      saveAsDraft: false
    }];

    const response = await fetch(
      'https://www.terragonlabs.com/dashboard',
      {
        method: 'POST',
        headers: {
          'accept': 'text/x-component',
          'content-type': 'text/plain;charset=UTF-8',
          'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
          'next-action': '7f7cba8a674421dfd9e9da7470ee4d79875a158bc9',
          'origin': 'https://www.terragonlabs.com',
          'referer': 'https://www.terragonlabs.com/dashboard',
          'user-agent': 'Mozilla/5.0',
          'x-deployment-id': 'dpl_3hWzkM7LiymSczFN21Z8chju84CV'
        },
        body: JSON.stringify(payload)
      }
    );

    const responseText = await response.text();
    const threadIdMatch = responseText.match(/"id":"([^"]+)"/);
    
    if (threadIdMatch) {
      const newInstanceId = threadIdMatch[1];
      this.registerInstance(newInstanceId, details.metadata);
    }
  }

  // Helper methods
  getInstancesSummary() {
    return Array.from(this.instances.values())
      .map(inst => `- ${inst.id} (${inst.type}): ${inst.status}`)
      .join('\n');
  }

  getRecentDecisions() {
    return this.decisionHistory
      .slice(-5)
      .map(d => `- ${new Date(d.timestamp).toISOString()}: ${d.action} - ${d.reasoning}`)
      .join('\n');
  }

  getRelatedInstances(instanceId) {
    const instance = this.instances.get(instanceId);
    if (!instance) return [];
    
    return Array.from(this.instances.values())
      .filter(inst => inst.parentId === instanceId || inst.id === instance.parentId);
  }

  buildTimeline(instanceId) {
    // Build a timeline of events for this instance and related ones
    const events = [];
    const instance = this.instances.get(instanceId);
    const related = this.getRelatedInstances(instanceId);
    
    // Add instance creation events
    events.push({
      time: instance.createdAt,
      event: `${instance.type} instance created`,
      instanceId
    });
    
    // Add message events
    instance.messages.forEach((msg, idx) => {
      events.push({
        time: msg.timestamp,
        event: `Message ${idx + 1}: ${msg.text.substring(0, 100)}...`,
        instanceId
      });
    });
    
    // Sort by time
    return events.sort((a, b) => a.time - b.time);
  }

  getCheckpointStatus(instance) {
    if (!instance.checkpoint) return null;
    
    // Extract checkpoint status from messages
    const lastMessage = instance.messages[instance.messages.length - 1];
    if (!lastMessage) return 'pending';
    
    const text = lastMessage.text.toLowerCase();
    if (text.includes('completed') || text.includes('done')) return 'completed';
    if (text.includes('failed') || text.includes('error')) return 'failed';
    if (text.includes('working') || text.includes('executing')) return 'in_progress';
    
    return 'unknown';
  }

  getTestResults(instanceId) {
    const instance = this.instances.get(instanceId);
    if (instance.type !== 'test') return null;
    
    // Extract test results from messages
    const results = [];
    for (const msg of instance.messages) {
      if (msg.text.includes('RESULT:')) {
        const passMatch = msg.text.match(/RESULT:\s*(PASS|FAIL)/i);
        const evidenceMatch = msg.text.match(/EVIDENCE:\s*([^\n]+)/i);
        
        results.push({
          passed: passMatch && passMatch[1].toUpperCase() === 'PASS',
          evidence: evidenceMatch ? evidenceMatch[1] : 'No evidence provided'
        });
      }
    }
    
    return results;
  }

  // Mark instance as complete
  async markComplete(instanceId) {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = 'completed';
      instance.completedAt = Date.now();
      instance.lastActivity = Date.now();
      console.log(`[Orchestrator] Instance ${instanceId} marked as complete`);
    }
  }

  // Escalate to human
  async escalateToHuman(details) {
    console.log('[ORCHESTRATOR] HUMAN ESCALATION REQUIRED');
    console.log('Reason:', details.reason);
    console.log('Context:', JSON.stringify(details.context, null, 2));
    console.log('Suggested actions:', details.suggestedActions);
    
    // In production, this would send notifications, create tickets, etc.
    // For now, just log prominently
  }
}

// API Handler
// FRANK'S SECURITY: API key auth
const ORCHESTRATOR_API_KEY = process.env.ORCHESTRATOR_API_KEY;
if (!ORCHESTRATOR_API_KEY) {
  console.error('[Orchestrator] ORCHESTRATOR_API_KEY not configured');
  throw new Error('ORCHESTRATOR_API_KEY environment variable required');
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Orchestrator-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // FRANK'S AUTH: Simple but effective
  const authKey = req.headers['x-orchestrator-key'];
  if (authKey !== ORCHESTRATOR_API_KEY) {
    console.error('[Orchestrator] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action } = req.body;
  
  // FRANK'S RATE LIMITING
  const clientIp = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  if (!rateLimiter.check(clientIp)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  
  // Create global orchestrator instance
  const orchestrator = global.taskOrchestrator || new TaskOrchestrator();
  global.taskOrchestrator = orchestrator;

  try {
    switch (action) {
      case 'register': {
        const { instanceId, metadata } = req.body;
        
        // FRANK'S VALIDATION
        if (!instanceId || typeof instanceId !== 'string' || instanceId.length > 100) {
          return res.status(400).json({ error: 'Invalid instance ID' });
        }
        
        if (!metadata || typeof metadata !== 'object') {
          return res.status(400).json({ error: 'Invalid metadata' });
        }
        
        try {
          orchestrator.registerInstance(instanceId, metadata);
          
          return res.status(200).json({
            status: 'registered',
            instanceId,
            message: 'Instance registered with orchestrator',
            limits: {
              currentInstances: orchestrator.instances.size,
              maxInstances: orchestrator.MAX_INSTANCES
            }
          });
        } catch (error) {
          return res.status(400).json({ error: error.message });
        }
      }
      
      case 'poll': {
        // Poll all registered instances
        const instances = Array.from(orchestrator.instances.keys());
        
        if (instances.length > 0) {
          console.log(`\n[Orchestrator] 📊 POLLING ${instances.length} instances...`);
          
          // Stream messages from all instances in parallel
          await Promise.all(
            instances.map(id => orchestrator.streamMessages(id))
          );
          
          console.log(`[Orchestrator] ✅ Polling complete\n`);
        }
        
        return res.status(200).json({
          status: 'polled',
          instanceCount: instances.length,
          instances: Array.from(orchestrator.instances.values()).map(inst => ({
            id: inst.id,
            type: inst.type,
            status: inst.status,
            messageCount: inst.messages.length,
            lastActivity: new Date(inst.lastActivity).toISOString()
          }))
        });
      }
      
      case 'decide': {
        // Force a decision for a specific instance
        const { instanceId } = req.body;
        console.log(`\n[Orchestrator] 🎯 DECISION REQUESTED for instance: ${instanceId}`);
        await orchestrator.analyzeAndDecide(instanceId);
        
        return res.status(200).json({
          status: 'decision_made',
          instanceId,
          lastDecision: orchestrator.decisionHistory[orchestrator.decisionHistory.length - 1]
        });
      }
      
      case 'status': {
        // Get orchestrator status
        const instances = Array.from(orchestrator.instances.values());
        const activeCount = instances.filter(inst => inst.status === 'active').length;
        
        return res.status(200).json({
          instances: instances.map(inst => ({
            id: inst.id,
            type: inst.type,
            status: inst.status,
            decisionCount: inst.decisionCount,
            age: Date.now() - inst.createdAt,
            lastActivity: Date.now() - inst.lastActivity
          })),
          decisionHistory: orchestrator.decisionHistory.slice(-10),
          activeCount,
          limits: {
            currentInstances: orchestrator.instances.size,
            maxInstances: orchestrator.MAX_INSTANCES,
            maxDecisionsPerInstance: orchestrator.MAX_DECISIONS_PER_INSTANCE
          },
          health: {
            status: orchestrator.instances.size < orchestrator.MAX_INSTANCES * 0.8 ? 'healthy' : 'warning',
            uptime: Date.now() - (orchestrator.startTime || Date.now())
          }
        });
      }
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Task Orchestrator Error:', error);
    // FRANK'S SECURITY: Never expose internal errors
    return res.status(500).json({ 
      error: 'Internal server error',
      requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`
    });
  }
}