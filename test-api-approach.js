// Test the API-based approach locally
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key-here'
});

async function testToolUse() {
    console.log('Testing Anthropic API with tool use...\n');
    
    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 1024,
            messages: [{
                role: 'user',
                content: 'Create a file called test.txt with the content "Hello from Claude"'
            }],
            tools: [{
                name: 'create_file',
                description: 'Create a new file',
                input_schema: {
                    type: 'object',
                    properties: {
                        filename: { type: 'string' },
                        content: { type: 'string' }
                    },
                    required: ['filename', 'content']
                }
            }]
        });
        
        console.log('Response:', JSON.stringify(response, null, 2));
        
        // Check if Claude used the tool
        const toolUse = response.content.find(c => c.type === 'tool_use');
        if (toolUse) {
            console.log('\n✅ Claude used the tool!');
            console.log('Tool:', toolUse.name);
            console.log('Input:', toolUse.input);
        } else {
            console.log('\n❌ Claude did not use the tool');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.message.includes('api_key')) {
            console.log('\n⚠️  Set ANTHROPIC_API_KEY environment variable');
        }
    }
}

testToolUse();