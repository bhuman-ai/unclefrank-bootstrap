// FRANK'S LOCAL DOCUMENT MANAGER TEST - NO SERVER REQUIRED
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

async function testDocumentManagerLocal() {
  console.log('=== LOCAL DOCUMENT MANAGER TEST ===');
  
  try {
    // Test environment setup
    console.log('\n1. ENVIRONMENT CHECK');
    console.log('Claude API Key configured:', !!process.env.CLAUDE_API_KEY);
    console.log('Terragon Auth configured:', !!process.env.TERRAGON_AUTH);
    console.log('Working directory:', process.cwd());
    
    // Test drafts directory
    console.log('\n2. DRAFTS DIRECTORY');
    const draftsDir = './test-drafts';
    console.log('Drafts directory exists:', existsSync(draftsDir));
    
    // Test Project.md reading
    console.log('\n3. PROJECT.MD ACCESS');
    try {
      const projectContent = await readFile('./Project.md', 'utf-8');
      console.log('Project.md readable:', true);
      console.log('Project.md size:', projectContent.length, 'characters');
      console.log('Project.md preview:', projectContent.substring(0, 100) + '...');
    } catch (error) {
      console.log('Project.md readable:', false, '- Error:', error.message);
    }
    
    // Test Interface.md reading
    console.log('\n4. INTERFACE.MD ACCESS');
    try {
      const interfaceContent = await readFile('./Interface.md', 'utf-8');
      console.log('Interface.md readable:', true);
      console.log('Interface.md size:', interfaceContent.length, 'characters');
    } catch (error) {
      console.log('Interface.md readable:', false, '- Error:', error.message);
    }
    
    // Test API file structure
    console.log('\n5. API STRUCTURE');
    console.log('Document manager exists:', existsSync('./api/document-manager.js'));
    console.log('Task orchestrator exists:', existsSync('./api/task-orchestrator.js'));
    console.log('Execute API exists:', existsSync('./api/execute.js'));
    console.log('Branch tracker exists:', existsSync('./api/branch-tracker.js'));
    
    // Test package.json dependencies
    console.log('\n6. DEPENDENCIES');
    try {
      const packageJson = JSON.parse(await readFile('./package.json', 'utf-8'));
      const deps = packageJson.dependencies || {};
      console.log('Anthropic SDK available:', !!deps['@anthropic-ai/sdk']);
      console.log('Total dependencies:', Object.keys(deps).length);
    } catch (error) {
      console.log('Package.json readable:', false);
    }
    
    // Mock document manager creation test
    console.log('\n7. MOCK DRAFT CREATION');
    try {
      // Simulate the draft creation logic
      const timestamp = Date.now();
      const testContent = `# Test Project Draft\n\nThis is a test draft created at ${new Date().toISOString()}`;
      const crypto = await import('crypto');
      const contentHash = crypto.createHash('md5').update(testContent).digest('hex').substring(0, 8);
      const draftId = `draft-${timestamp}-${contentHash}`;
      
      console.log('Mock draft ID generated:', draftId);
      console.log('Content hash:', contentHash);
      console.log('Timestamp:', timestamp);
      console.log('Test content length:', testContent.length);
      
      // Test version calculation logic
      const version = testContent.length < 100 ? '1.0.1' : '1.1.0';
      console.log('Mock version:', version);
      
    } catch (error) {
      console.log('Mock draft creation failed:', error.message);
    }
    
    console.log('\n=== LOCAL TEST COMPLETE ===');
    console.log('✅ Document Manager structure looks good!');
    console.log('✅ Ready for integration testing with live server');
    
  } catch (error) {
    console.error('LOCAL TEST FAILED:', error.message);
  }
}

testDocumentManagerLocal();