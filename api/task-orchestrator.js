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
    this.baseUrl = 'https://www.claudelabs.com';
    this.deploymentId = 'dpl_EcYagrYkth26MSww72T3G2EZGiUH';
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

  // Register a new Claude instance to monitor
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
      console.log(`[Orchestrator] 📡 Fetching from: ${this.baseUrl}/task/${instanceId}`);
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
      
      // Log response for debugging
      if (content.length < 1000) {
        console.log(`[Orchestrator] 📄 Response: ${content}`);
      } else {
        console.log(`[Orchestrator] 📄 Response (first 500 chars): ${content.substring(0, 500)}...`);
      }
      
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

  // Extract messages from Claude response
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

  // Extract status from Claude response
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
        model: 'claude-opus-4-20250514',
        max_tokens: 1000, // FRANK'S LIMIT: Smaller responses
        messages: [{
          role: 'user',
          content: `You are monitoring Claude instance ${instanceId}. Type: ${instance.type}, Status: ${instance.status}, Messages: ${instance.messages.length}, Already decomposed: ${instance.decomposition ? 'yes' : 'no'}.

${instance.type === 'main-task' && !instance.decomposition ? `This is a main task that needs decomposition. The task has ${instance.messages.length} messages. If there are at least 2 messages (user request + initial response), decompose it into checkpoints.` : 'This instance does not need decomposition.'}

Return ONLY JSON: {"action":"[decompose_task or wait]","targetInstance":"${instanceId}","details":{},"reasoning":"[your reasoning]"}`
        }]
      });
      
      // FRANK'S SAFE JSON PARSING
      let decision;
      try {
        const rawDecision = response.content[0].text;
        console.log(`[Orchestrator] 📝 RAW RESPONSE: ${rawDecision.substring(0, 200)}...`);
        
        // Try to extract JSON from the response
        // Sometimes LLMs add explanatory text before/after JSON
        let jsonString = rawDecision;
        
        // Look for JSON object pattern
        const jsonMatch = rawDecision.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
          console.log(`[Orchestrator] 🔍 Extracted JSON from response`);
        }
        
        // Remove any potential code execution attempts
        const sanitized = jsonString.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        decision = JSON.parse(sanitized);
        
        console.log(`[Orchestrator] 🎯 DECISION: ${decision.action}`);
        console.log(`[Orchestrator] 💭 REASONING: ${decision.reasoning}`);
      } catch (parseError) {
        console.error('[Orchestrator] ❌ PARSE ERROR:', parseError.message);
        console.error('[Orchestrator] 📝 RAW RESPONSE WAS:', response.content[0].text.substring(0, 500));
        // Default to safe wait action
        decision = { action: 'wait', reasoning: 'Failed to parse LLM response' };
      }
      
      // FRANK'S VALIDATION: Sanitize decision
      const allowedActions = ['send_message', 'create_instance', 'mark_complete', 'escalate', 'wait', 'decompose_task'];
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
        
      case 'decompose_task':
        console.log(`[Orchestrator] 📋 DECOMPOSING TASK into checkpoints`);
        await this.decomposeTask(decision.targetInstance, decision.details);
        break;
    }
  }

  // Send message to a Claude instance
  async sendMessage(instanceId, message) {
    console.log(`[Orchestrator] 📮 SENDING MESSAGE to ${instanceId}`);
    console.log(`[Orchestrator] 📝 Message preview: "${message.substring(0, 100)}..."`);
    
    try {
      // Use the working send-claude-message endpoint
      const apiBase = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';
      
      const response = await fetch(
        `${apiBase}/api/send-claude-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            threadId: instanceId,
            message: message
          })
        }
      );

      const result = await response.json();
      const success = result.success === true && result.debug?.responsePreview?.includes('"status":"success"');
      
      console.log(`[Orchestrator] 📨 MESSAGE RESPONSE: ${response.status} - ${success ? 'SUCCESS' : 'FAILED'}`);
      
      if (!success) {
        console.error(`[Orchestrator] ❌ Failed to send message:`, result.message || 'Unknown error');
        console.error(`[Orchestrator] Debug:`, result.debug);
      } else {
        console.log(`[Orchestrator] ✅ Message sent successfully via send-claude-message`);
      }
      
      return success;
    } catch (error) {
      console.error(`[Orchestrator] ❌ Error sending message:`, error.message);
      return false;
    }
  }

  // Create a new Claude instance
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
      'https://www.claudelabs.com/dashboard',
      {
        method: 'POST',
        headers: {
          'accept': 'text/x-component',
          'content-type': 'text/plain;charset=UTF-8',
          'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
          'next-action': '7f7cba8a674421dfd9e9da7470ee4d79875a158bc9',
          'origin': 'https://www.claudelabs.com',
          'referer': 'https://www.claudelabs.com/dashboard',
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

  // Decompose task into checkpoints
  async decomposeTask(instanceId, details) {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      console.error(`[Orchestrator] ❌ Instance not found: ${instanceId}`);
      return;
    }
    
    console.log(`[Orchestrator] 🧠 TASK DECOMPOSITION STARTING for ${instanceId}`);
    console.log(`[Orchestrator] 📝 Task context:`, JSON.stringify(details, null, 2));
    console.log(`[Orchestrator] 📌 Instance status: ${instance.status}`);
    console.log(`[Orchestrator] 📌 Instance messages: ${instance.messages.length}`);
    
    try {
      // Extract task details from instance messages
      const taskMessages = instance.messages.map(m => m.text).join('\n');
      
      console.log(`[Orchestrator] 🔍 ANALYZING: Extracting task requirements...`);
      console.log(`[Orchestrator] 📊 Message count: ${instance.messages.length}`);
      console.log(`[Orchestrator] 📝 Task content: "${taskMessages.substring(0, 100)}..."`);
      
      if (!taskMessages || taskMessages.trim().length === 0) {
        console.error(`[Orchestrator] ❌ No task messages found`);
        return;
      }
      
      // Ask Claude to decompose the task
      console.log(`[Orchestrator] 🤔 CONSULTING: Asking Claude to decompose task into checkpoints...`);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-20250514',
        max_tokens: 2000, // More tokens for detailed decomposition
        messages: [{
          role: 'user',
          content: `You are decomposing a task into checkpoints. The task is: "${taskMessages.substring(0, 500).replace(/["\n]/g, ' ')}". 

Create 2-3 specific checkpoints for this exact task. Return ONLY a JSON object with real, actionable steps (not placeholders).

Example format:
{"taskSummary":"Create user profile component","checkpoints":[{"id":"cp1","name":"Build profile UI","objective":"Create the visual component","blocking":true,"dependencies":[],"instructions":["Create ProfileComponent.js","Add avatar image display","Add name and bio fields"],"passCriteria":[{"type":"component_exists","description":"ProfileComponent renders without errors"},{"type":"ui_complete","description":"Shows avatar, name, and bio"}]}],"estimatedDuration":"30 minutes","riskFactors":["Image loading errors"]}

Now create checkpoints for the given task. Return only JSON:`
        }]
      });

      let decomposition;
      try {
        const rawDecomposition = response.content[0].text;
        console.log(`[Orchestrator] 📝 RAW DECOMPOSITION:`, rawDecomposition.substring(0, 500) + '...');
        
        // Try to extract JSON from the response
        let jsonString = rawDecomposition;
        
        // Look for JSON object pattern
        const jsonMatch = rawDecomposition.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
          console.log(`[Orchestrator] 🔍 Extracted JSON from decomposition response`);
        }
        
        decomposition = JSON.parse(jsonString);
        
        console.log(`[Orchestrator] ✅ DECOMPOSITION COMPLETE:`);
        console.log(`[Orchestrator]   - Task: ${decomposition.taskSummary}`);
        console.log(`[Orchestrator]   - Checkpoints: ${decomposition.checkpoints.length}`);
        console.log(`[Orchestrator]   - Duration: ${decomposition.estimatedDuration}`);
        console.log(`[Orchestrator]   - Risks: ${decomposition.riskFactors?.length || 0}`);
        
        // Log each checkpoint
        decomposition.checkpoints.forEach((cp, idx) => {
          console.log(`[Orchestrator] 📍 Checkpoint ${idx + 1}/${decomposition.checkpoints.length}:`);
          console.log(`[Orchestrator]     ID: ${cp.id}`);
          console.log(`[Orchestrator]     Name: ${cp.name}`);
          console.log(`[Orchestrator]     Blocking: ${cp.blocking ? 'YES' : 'NO'}`);
          console.log(`[Orchestrator]     Dependencies: ${cp.dependencies?.join(', ') || 'None'}`);
          console.log(`[Orchestrator]     Pass Criteria: ${cp.passCriteria?.length || 0} tests`);
        });
        
      } catch (parseError) {
        console.error('[Orchestrator] ❌ DECOMPOSITION PARSE ERROR:', parseError.message);
        console.error('[Orchestrator] 📝 RAW RESPONSE WAS:', response.content[0].text.substring(0, 500));
        decomposition = {
          taskSummary: 'Failed to decompose task',
          checkpoints: [],
          error: parseError.message
        };
      }
      
      // Send decomposition back to Claude instance
      const decompositionMessage = `# TASK DECOMPOSITION COMPLETE

## Task Summary
${decomposition.taskSummary}

## Estimated Duration
${decomposition.estimatedDuration || 'Unknown'}

## Risk Factors
${(decomposition.riskFactors || []).map(r => `- ${r}`).join('\n') || 'None identified'}

## Checkpoints (${decomposition.checkpoints.length})
${decomposition.checkpoints.map((cp, idx) => `
### ${idx + 1}. ${cp.name}
- **ID:** ${cp.id}
- **Objective:** ${cp.objective}
- **Blocking:** ${cp.blocking ? 'Yes' : 'No'}
- **Dependencies:** ${cp.dependencies?.join(', ') || 'None'}

**Instructions:**
${cp.instructions.map((inst, i) => `${i + 1}. ${inst}`).join('\n')}

**Pass Criteria:**
${cp.passCriteria.map(pc => `✓ ${pc.description}`).join('\n')}
`).join('\n')}

Ready to begin execution. Will start with checkpoint: ${decomposition.checkpoints[0]?.name || 'Unknown'}`;

      console.log(`[Orchestrator] 📤 SENDING decomposition to Claude instance ${instanceId}`);
      await this.sendMessage(instanceId, decompositionMessage);
      
      // Store decomposition in instance metadata
      instance.decomposition = decomposition;
      instance.lastActivity = Date.now();
      
      console.log(`[Orchestrator] ✅ DECOMPOSITION SENT - Task ready for execution`);
      
    } catch (error) {
      console.error('[Orchestrator] 🚨 DECOMPOSITION ERROR:', error.message);
      await this.sendMessage(instanceId, `ERROR: Failed to decompose task - ${error.message}`);
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