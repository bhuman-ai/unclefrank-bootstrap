// Test Claude with a real task
const CLAUDE_URL = 'https://uncle-frank-claude.fly.dev';

async function testClaude() {
    console.log('🧪 Testing Claude with real file creation task\n');
    
    // Create session
    console.log('1️⃣ Creating session...');
    const sessionResponse = await fetch(`${CLAUDE_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    
    const session = await sessionResponse.json();
    console.log('✅ Session created:', session.sessionId);
    console.log('   Branch:', session.branch);
    console.log('   GitHub URL:', session.githubUrl);
    
    // Execute a real task
    console.log('\n2️⃣ Asking Claude to create a Python script...');
    const executeResponse = await fetch(`${CLAUDE_URL}/api/sessions/${session.sessionId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: `Create a Python script called hello_frank.py that:
1. Prints "Hello from Uncle Frank!"
2. Gets the current time
3. Prints the time in a friendly format`
        })
    });
    
    const result = await executeResponse.json();
    console.log('\n📝 Claude\'s response:');
    console.log(result.response);
    
    if (result.files && result.files.length > 0) {
        console.log('\n✅ Files created/modified:');
        result.files.forEach(f => {
            console.log(`   ${f.status} ${f.path}`);
        });
    } else {
        console.log('\n❌ No files were created');
    }
    
    // Check session status
    console.log('\n3️⃣ Checking session status...');
    const statusResponse = await fetch(`${CLAUDE_URL}/api/sessions/${session.sessionId}`);
    const status = await statusResponse.json();
    console.log('   Status:', status.status);
    console.log('   Git changes:', status.gitStatus);
    
    // Test another command
    console.log('\n4️⃣ Testing git command execution...');
    const gitResponse = await fetch(`${CLAUDE_URL}/api/sessions/${session.sessionId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: 'Run git status and show me what files we have'
        })
    });
    
    const gitResult = await gitResponse.json();
    console.log('\n📝 Git status response:');
    console.log(gitResult.response);
    
    console.log('\n✅ Test complete!');
    console.log(`View the branch: ${session.githubUrl}`);
}

testClaude().catch(console.error);