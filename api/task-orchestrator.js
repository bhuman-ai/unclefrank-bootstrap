// FRANK'S TASK ORCHESTRATOR - THE BRAIN THAT CONTROLS ALL TERRAGON INSTANCES
// No hard rules, just intelligent decisions based on context

import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const TERRAGON_AUTH = process.env.TERRAGON_AUTH || 'JTgr3pSvWUN2bNmaO66GnTGo2wrk1zFf.fW4Qo8gvM1lTf%2Fis9Ss%2FJOdlSKJrnLR0CapMdm%2Bcy0U%3D';

class TaskOrchestrator {
  constructor() {
    this.baseUrl = 'https://www.terragonlabs.com';
    this.deploymentId = 'dpl_3hWzkM7LiymSczFN21Z8chju84CV';
    this.anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });
    
    // Track all active instances and their relationships
    this.instances = new Map();
    this.messageStreams = new Map();
    this.decisionHistory = [];
  }

  // Register a new Terragon instance to monitor
  registerInstance(instanceId, metadata) {
    this.instances.set(instanceId, {
      id: instanceId,
      type: metadata.type, // 'main-task', 'test', 'resolver', etc.
      parentId: metadata.parentId,
      checkpoint: metadata.checkpoint,
      branch: metadata.branch,
      status: 'active',
      messages: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metadata
    });
    
    console.log(`[Orchestrator] Registered ${metadata.type} instance: ${instanceId}`);
  }

  // Stream messages from all instances
  async streamMessages(instanceId) {
    const instance = this.instances.get(instanceId);
    if (!instance) return;
    
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
      
      // Update instance state
      instance.messages = messages;
      instance.status = status;
      instance.lastActivity = Date.now();
      
      // Trigger decision making if needed
      await this.analyzeAndDecide(instanceId);
      
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
    
    // Build context for the LLM
    const context = this.buildContext(instanceId);
    
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `You are Uncle Frank's Task Orchestrator, monitoring multiple Terragon instances.

Current Instance: ${instanceId} (${instance.type})
Status: ${instance.status}
Latest Messages: ${JSON.stringify(instance.messages.slice(-5), null, 2)}

All Active Instances:
${this.getInstancesSummary()}

Recent Decision History:
${this.getRecentDecisions()}

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
      
      const decision = JSON.parse(response.content[0].text);
      await this.executeDecision(decision);
      
    } catch (error) {
      console.error('[Orchestrator] Decision-making error:', error);
    }
  }

  // Build comprehensive context
  buildContext(instanceId) {
    const instance = this.instances.get(instanceId);
    const relatedInstances = this.getRelatedInstances(instanceId);
    
    return {
      currentInstance: instance,
      relatedInstances,
      timeline: this.buildTimeline(instanceId),
      checkpointStatus: this.getCheckpointStatus(instance),
      testResults: this.getTestResults(instanceId)
    };
  }

  // Execute the LLM's decision
  async executeDecision(decision) {
    this.decisionHistory.push({
      ...decision,
      timestamp: Date.now()
    });
    
    console.log(`[Orchestrator] Executing: ${decision.action} - ${decision.reasoning}`);
    
    switch (decision.action) {
      case 'send_message':
        await this.sendMessage(decision.targetInstance, decision.details.message);
        break;
        
      case 'create_instance':
        await this.createInstance(decision.details);
        break;
        
      case 'mark_complete':
        await this.markComplete(decision.targetInstance);
        break;
        
      case 'escalate':
        await this.escalateToHuman(decision.details);
        break;
        
      case 'wait':
        // Do nothing, just wait for more data
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
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;
  
  // Create global orchestrator instance
  const orchestrator = global.taskOrchestrator || new TaskOrchestrator();
  global.taskOrchestrator = orchestrator;

  try {
    switch (action) {
      case 'register': {
        const { instanceId, metadata } = req.body;
        orchestrator.registerInstance(instanceId, metadata);
        
        return res.status(200).json({
          status: 'registered',
          instanceId,
          message: 'Instance registered with orchestrator'
        });
      }
      
      case 'poll': {
        // Poll all registered instances
        const instances = Array.from(orchestrator.instances.keys());
        
        // Stream messages from all instances in parallel
        await Promise.all(
          instances.map(id => orchestrator.streamMessages(id))
        );
        
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
        await orchestrator.analyzeAndDecide(instanceId);
        
        return res.status(200).json({
          status: 'decision_made',
          instanceId,
          lastDecision: orchestrator.decisionHistory[orchestrator.decisionHistory.length - 1]
        });
      }
      
      case 'status': {
        // Get orchestrator status
        return res.status(200).json({
          instances: Array.from(orchestrator.instances.values()),
          decisionHistory: orchestrator.decisionHistory.slice(-10),
          activeCount: Array.from(orchestrator.instances.values())
            .filter(inst => inst.status === 'active').length
        });
      }
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Task Orchestrator Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}