# Deployment Setup Guide

## ⚠️ CRITICAL: Required Configuration

RED TEAM was right - the system won't work without proper configuration. Follow these steps:

## 1. Vercel Environment Variables (REQUIRED)

Go to your Vercel project settings and add these environment variables:

```bash
# REQUIRED - Without this, GitHub integration fails
GITHUB_TOKEN=ghp_YOUR_PERSONAL_ACCESS_TOKEN

# REQUIRED - Your repo
GITHUB_REPO=bhuman-ai/unclefrank-bootstrap

# Claude Executor URL (if deployed)
CLAUDE_EXECUTOR_URL=https://uncle-frank-claude.fly.dev
```

## 2. GitHub Personal Access Token

1. Go to GitHub Settings → Developer Settings → Personal Access Tokens
2. Generate a new token with these scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
3. Copy the token and add it to Vercel

## 3. Known Issues (RED TEAM Found These)

### ❌ Current Problems:
1. **File System Dependencies** - The system tries to read/write local files which don't work on Vercel
2. **No State Persistence** - Refresh = lose everything
3. **Checkpoints Don't Work** - They're just for show (see `/docs/current-state/checkpoint.md`)

### 🔧 Temporary Workarounds:
- Drafts are stored in `/tmp` (ephemeral, will be lost)
- Validation uses placeholder content (not actual Interface.md/Technical.md)
- No real file persistence until we implement cloud storage

## 4. What Actually Works

✅ **Frontend UI** - The interface loads and looks good
✅ **Frank Chat** - Can parse messages (if API works)
✅ **Task Generation Logic** - Has smart fallbacks
❌ **Draft Storage** - Lost on serverless function restart
❌ **Validation** - Can't read actual specification files
❌ **GitHub Integration** - Works only with proper token

## 5. Local Development

```bash
# Install dependencies
npm install

# Create .env.local (copy from .env.example)
cp .env.example .env.local

# Edit .env.local with your values
# - Add your GitHub token
# - Update URLs

# Run locally
npm run dev
```

## 6. Production Deployment

```bash
# Push to GitHub (auto-deploys to Vercel)
git push origin master

# CRITICAL: Add environment variables in Vercel dashboard
# Without them, you'll get "NOT_FOUND" errors
```

## 7. Testing After Deployment

1. Check `/api/frank-assistant` - Should return 200, not 500
2. Check `/api/project-draft-manager?action=list` - Should return draft list
3. Try creating a draft - Will fail without GitHub token

## 8. What Needs Fixing (Priority Order)

1. **Add GitHub Token** - Nothing works without it
2. **Implement Cloud Storage** - Replace filesystem with Vercel Blob or S3
3. **Add State Persistence** - Use database or cloud storage
4. **Fix Checkpoints** - Currently fake, need real implementation
5. **Add Error Recovery** - Better error messages and retry logic

## RED TEAM Was Right About:

- ES6 imports breaking Vercel functions ✅ FIXED
- Hardcoded local paths not working ✅ PARTIALLY FIXED (using /tmp)
- Missing environment variables ✅ DOCUMENTED
- No error recovery ❌ STILL BROKEN
- Checkpoints being fake ❌ STILL BROKEN
- State persistence missing ❌ STILL BROKEN

## The Truth:

This is a **proof of concept** that needs significant work to be production-ready. The frontend works, but the backend needs:
- Cloud storage implementation
- Proper error handling
- State persistence
- Real checkpoint system
- Better deployment configuration

Frank would say: "It's half-baked. Fix the basics before calling it done."