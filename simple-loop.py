#!/usr/bin/env python3
"""
The simplest loop that actually works.
No bullshit. No complexity. Just progress.
"""

import os
import time
from anthropic import Anthropic

# Get API key
api_key = os.getenv("ANTHROPIC_API_KEY")
if not api_key:
    print("Set ANTHROPIC_API_KEY environment variable")
    exit(1)

client = Anthropic(api_key=api_key)

# Create initial files if they don't exist
if not os.path.exists("target.md"):
    with open("target.md", "w") as f:
        f.write("""# Target: Simple Task Tracker

Create a working task tracker with:
1. Add tasks
2. Mark tasks complete
3. Show task list
4. Save to file

Make it work. Make it simple. Make it real.
""")

if not os.path.exists("current.md"):
    with open("current.md", "w") as f:
        f.write("# Current State\n\nNothing built yet.\n")

# THE LOOP
iteration = 0
while True:
    iteration += 1
    print(f"\n{'='*50}")
    print(f"ITERATION {iteration}")
    print('='*50)
    
    # Read current state
    target = open("target.md").read()
    current = open("current.md").read()
    
    # Find ONE thing to do
    print("\n🤔 Finding next step...")
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1000,
        messages=[{
            "role": "user", 
            "content": f"""Target state:
{target}

Current state:
{current}

What is ONE SPECIFIC small thing to build next? 
Be concrete. Give me actual code or content to add.
Just tell me WHAT to build, not how.
Keep it SIMPLE."""
        }]
    )
    
    next_step = response.content[0].text
    print(f"\n📋 Next step: {next_step[:200]}...")
    
    # Build it
    print("\n🔨 Building...")
    build_response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=4000,
        messages=[{
            "role": "user",
            "content": f"""Current state:
{current}

Build this: {next_step}

Give me the EXACT code or content to add/create.
If it's code, give me the complete file.
Start your response with either:
FILE: filename.py
or
UPDATE_CURRENT:

Then the actual content."""
        }]
    )
    
    build_output = build_response.content[0].text
    
    # Save it
    if build_output.startswith("FILE:"):
        lines = build_output.split("\n")
        filename = lines[0].replace("FILE:", "").strip()
        content = "\n".join(lines[1:])
        
        print(f"\n💾 Creating {filename}")
        with open(filename, "w") as f:
            f.write(content)
        
        # Update current.md
        with open("current.md", "a") as f:
            f.write(f"\n\n## Iteration {iteration}\nCreated: {filename}\n")
    
    elif build_output.startswith("UPDATE_CURRENT:"):
        content = build_output.replace("UPDATE_CURRENT:", "").strip()
        print(f"\n📝 Updating current state")
        with open("current.md", "w") as f:
            f.write(content)
    
    print("\n✅ Done with this iteration")
    print("\nPress Ctrl+C to stop, or wait 5 seconds for next iteration...")
    
    try:
        time.sleep(5)
    except KeyboardInterrupt:
        print("\n\n👋 Stopping loop. Check your files!")
        break

print("\n🎯 Loop complete. Check what was built!")