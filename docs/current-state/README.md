# Current State Documentation

## Purpose
This folder contains documentation of what **ACTUALLY WORKS** in production right now. This is our source of truth for the current system state.

## Documents

### 📄 project.md
- What features are actually deployed and working
- Current limitations and known issues
- How to use what's available
- Real deployment URLs and status

### 📄 technical.md  
- Actual system architecture on Fly.io and Vercel
- Current data flows and API endpoints
- Real technical constraints we face
- Deployment processes that work

### 📄 interface.md
- UI components that exist and function
- Current user flows that work
- Tech stack actually in use
- Real browser compatibility

### 📄 task.md
- How tasks actually get executed now
- Current GitHub integration
- What Claude really does
- Manual processes required

### 📄 checkpoint.md
- The truth: checkpoints don't work yet
- APIs that exist but aren't integrated
- What actually happens during execution
- Manual workarounds we use

## Important Notes

### What This IS
✅ Documentation of current production state  
✅ Honest assessment of what works  
✅ Real limitations and workarounds  
✅ Actual deployment processes  

### What This IS NOT
❌ Future plans or vision  
❌ Theoretical architecture  
❌ Wishful thinking  
❌ Marketing material  

## Relationship to Other Docs

### `/docs to work towards/`
Contains our vision and target architecture. This is what we're building toward with our doc-driven development system.

### `/CLAUDE.md` (Root)
Our immutable constitution - the principles and instructions that govern how we develop. This never changes and applies to all LLM interactions.

### `/Project.md` (Root)  
High-level project documentation that bridges current state and future vision.

## How to Use These Docs

### For Development
1. Check current-state docs to understand what actually works
2. Refer to "docs to work towards" for the target
3. Use CLAUDE.md principles for all development
4. Create drafts to bridge current → future

### For Debugging
- Start here to understand actual system behavior
- Check technical.md for real architecture
- Review task.md for execution flow
- Look at checkpoint.md to understand limitations

### For Onboarding
- Read these first to understand reality
- Then read "docs to work towards" for context
- Finally read CLAUDE.md for development principles

## Maintenance

These documents should be updated whenever:
- A new feature is deployed to production
- A workaround becomes standard practice  
- A limitation is discovered
- Something breaks or gets fixed

**Remember**: These docs reflect reality, not aspiration. Keep them honest and current.

---

*Last Updated: January 2025*  
*Maintained by: Uncle Frank's Team*