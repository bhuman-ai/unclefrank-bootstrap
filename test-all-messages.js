#!/usr/bin/env node

const API_BASE = 'https://unclefrank-bootstrap-ellm56p3u-bhuman.vercel.app';
const TERRAGON_AUTH = process.env.TERRAGON_AUTH;

async function fetchAllMessages(threadId) {
  const response = await fetch(
    `https://www.terragonlabs.com/task/${threadId}`,
    {
      method: 'POST',
      headers: {
        'accept': 'text/x-component',
        'content-type': 'text/plain;charset=UTF-8',
        'cookie': `__Secure-better-auth.session_token=${TERRAGON_AUTH}`,
        'next-action': '7f7f75ac3cce9016222850cb0f9b89dacfcdb75c9b',
        'origin': 'https://www.terragonlabs.com',
        'referer': `https://www.terragonlabs.com/task/${threadId}`,
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'x-deployment-id': 'dpl_EcYagrYkth26MSww72T3G2EZGiUH'
      },
      body: JSON.stringify([threadId])
    }
  );

  const content = await response.text();
  
  // Extract ALL messages
  const messages = [];
  
  // First, let's see what we're getting
  console.log('Raw content length:', content.length);
  console.log('First 500 chars:', content.substring(0, 500));
  
  // Try multiple patterns to extract messages
  // Pattern 1: Look for message objects
  const messagePattern = /"messages":\[(.*?)\],"createdAt"/s;
  const messagesMatch = content.match(messagePattern);
  
  if (messagesMatch) {
    const messagesJson = '[' + messagesMatch[1] + ']';
    try {
      const parsedMessages = JSON.parse(messagesJson);
      parsedMessages.forEach(msg => {
        if (msg.parts && msg.parts[0] && msg.parts[0].nodes && msg.parts[0].nodes[0]) {
          messages.push(msg.parts[0].nodes[0].text);
        }
      });
    } catch (e) {
      console.log('Failed to parse messages JSON');
    }
  }
  
  // Fallback: Pattern 2: Direct text extraction
  const textMatches = [...content.matchAll(/"text":"([^"]+)"/g)];
  textMatches.forEach(match => {
    const text = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    if (!messages.includes(text)) {
      messages.push(text);
    }
  });
  
  return messages;
}

async function test() {
  const threadId = 'e1bf8f98-9ef0-4612-bd71-d8496667af0a';
  
  console.log('🔍 Fetching ALL messages from thread...\n');
  console.log(`Thread: ${threadId}`);
  console.log(`URL: https://www.terragonlabs.com/task/${threadId}\n`);
  
  const messages = await fetchAllMessages(threadId);
  
  console.log(`Total messages found: ${messages.length}\n`);
  
  console.log('📝 ALL MESSAGES:');
  console.log('='.repeat(70));
  
  messages.forEach((msg, i) => {
    console.log(`\n--- Message ${i + 1} ---`);
    console.log(msg);
    console.log('-'.repeat(70));
  });
  
  // Look for test messages
  const testMessages = messages.filter(msg => 
    msg.includes('test message sent at') || 
    msg.includes('Hi! This is the first') ||
    msg.includes('And this is the second')
  );
  
  console.log(`\n\n🔍 TEST MESSAGES FOUND: ${testMessages.length}`);
  if (testMessages.length > 0) {
    console.log('\n✅ ✅ ✅ TEST MESSAGES SUCCESSFULLY SENT! ✅ ✅ ✅\n');
    testMessages.forEach((msg, i) => {
      console.log(`Test Message ${i + 1}: ${msg}`);
    });
  } else {
    console.log('\n❌ No test messages found in the thread');
  }
}

test().catch(console.error);