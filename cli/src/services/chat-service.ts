import { TerragonProxy } from '../core/terragon-proxy';
import chalk from 'chalk';
import { EventEmitter } from 'events';

interface ChatMessage {
  id: string;
  threadId: string;
  text: string;
  timestamp: string;
  type: 'user' | 'assistant';
  sender?: string;
}

interface ChatSession {
  threadId: string;
  startedAt: Date;
  lastActivity: Date;
  messageCount: number;
  autoReplyEnabled: boolean;
  autoReplyPatterns?: Map<RegExp, string[]>;
}

export class ChatService extends EventEmitter {
  private terragonProxy: TerragonProxy;
  private sessions = new Map<string, ChatSession>();
  private messageHistory = new Map<string, ChatMessage[]>();
  
  constructor(terragonAuth: string) {
    super();
    this.terragonProxy = new TerragonProxy(terragonAuth);
  }

  async createSession(options: {
    threadId?: string;
    autoReply?: boolean;
    patterns?: Map<RegExp, string[]>;
  } = {}): Promise<string> {
    const threadId = options.threadId || await this.terragonProxy.createChatThread();
    
    const session: ChatSession = {
      threadId,
      startedAt: new Date(),
      lastActivity: new Date(),
      messageCount: 0,
      autoReplyEnabled: options.autoReply || false,
      autoReplyPatterns: options.patterns
    };
    
    this.sessions.set(threadId, session);
    this.messageHistory.set(threadId, []);
    
    // Start listening to messages
    await this.terragonProxy.startListening(
      threadId,
      (message) => this.handleIncomingMessage(threadId, message),
      (error) => this.emit('error', { threadId, error })
    );
    
    this.emit('session:created', { threadId, session });
    return threadId;
  }

  async sendMessage(threadId: string, text: string, sender: string = 'user'): Promise<void> {
    const session = this.sessions.get(threadId);
    if (!session) {
      throw new Error(`No active session for thread ${threadId}`);
    }
    
    try {
      // Send to Terragon
      await this.terragonProxy.sendChatMessage(threadId, text);
      
      // Update session
      session.lastActivity = new Date();
      session.messageCount++;
      
      // Store in history
      const message: ChatMessage = {
        id: `${threadId}-${Date.now()}`,
        threadId,
        text,
        timestamp: new Date().toISOString(),
        type: 'user',
        sender
      };
      
      this.addToHistory(threadId, message);
      this.emit('message:sent', message);
      
    } catch (error) {
      this.emit('error', { threadId, error, action: 'send' });
      throw error;
    }
  }

  private async handleIncomingMessage(threadId: string, rawMessage: any): Promise<void> {
    const session = this.sessions.get(threadId);
    if (!session) return;
    
    // Update session
    session.lastActivity = new Date();
    session.messageCount++;
    
    // Create message object
    const message: ChatMessage = {
      id: rawMessage.id || `${threadId}-${Date.now()}`,
      threadId,
      text: rawMessage.text,
      timestamp: rawMessage.timestamp || new Date().toISOString(),
      type: 'assistant'
    };
    
    this.addToHistory(threadId, message);
    this.emit('message:received', message);
    
    // Handle auto-reply if enabled
    if (session.autoReplyEnabled && session.autoReplyPatterns) {
      this.processAutoReply(threadId, message);
    }
  }

  private async processAutoReply(threadId: string, incomingMessage: ChatMessage): Promise<void> {
    const session = this.sessions.get(threadId);
    if (!session?.autoReplyPatterns) return;
    
    // Find matching pattern
    for (const [pattern, responses] of session.autoReplyPatterns) {
      if (pattern.test(incomingMessage.text)) {
        const reply = responses[Math.floor(Math.random() * responses.length)];
        
        // Add natural delay
        const delay = 1000 + Math.random() * 2000;
        
        setTimeout(async () => {
          try {
            await this.sendMessage(threadId, reply, 'auto-reply');
            this.emit('auto:reply', { threadId, trigger: incomingMessage.text, reply });
          } catch (error) {
            this.emit('error', { threadId, error, action: 'auto-reply' });
          }
        }, delay);
        
        break;
      }
    }
  }

  getSession(threadId: string): ChatSession | undefined {
    return this.sessions.get(threadId);
  }

  getHistory(threadId: string): ChatMessage[] {
    return this.messageHistory.get(threadId) || [];
  }

  private addToHistory(threadId: string, message: ChatMessage): void {
    const history = this.messageHistory.get(threadId) || [];
    history.push(message);
    
    // Keep only last 100 messages per thread
    if (history.length > 100) {
      history.shift();
    }
    
    this.messageHistory.set(threadId, history);
  }

  async closeSession(threadId: string): Promise<void> {
    const session = this.sessions.get(threadId);
    if (!session) return;
    
    this.terragonProxy.stopListening(threadId);
    this.sessions.delete(threadId);
    
    this.emit('session:closed', { threadId, session });
  }

  async closeAllSessions(): Promise<void> {
    for (const threadId of this.sessions.keys()) {
      await this.closeSession(threadId);
    }
    this.terragonProxy.stopAllListeners();
  }

  getActiveSessions(): Array<{ threadId: string; session: ChatSession }> {
    return Array.from(this.sessions.entries()).map(([threadId, session]) => ({
      threadId,
      session
    }));
  }

  // Brooklyn-specific auto-reply patterns
  static getBrooklynPatterns(): Map<RegExp, string[]> {
    const patterns = new Map<RegExp, string[]>();
    
    patterns.set(
      /where.*from.*bk|brooklyn/i,
      [
        "Bensonhurst, born and raised. Real Brooklyn, not the artisanal pickle nonsense.",
        "Bay Ridge. Where the pizza's still a dollar and the people still got character.",
        "Sheepshead Bay. Used to catch dinner right off the pier before the yuppies showed up."
      ]
    );
    
    patterns.set(
      /what.*doing|task|working/i,
      [
        "Breaking down your mess into bite-sized pieces. You know, actual work.",
        "Making your vague ideas into something a computer can understand. Magic, right?",
        "Turning BS into executable code. It's a gift."
      ]
    );
    
    patterns.set(
      /help|assist|can you/i,
      [
        "Yeah, whaddya need? Be specific or we'll be here all day.",
        "Sure, but you gotta tell me exactly what you want. I ain't a mind reader.",
        "I can help, but none of this 'figure it out' crap. Give me details."
      ]
    );
    
    return patterns;
  }
}