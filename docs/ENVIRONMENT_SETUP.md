# Environment Setup Guide

## Security Notice
⚠️ **Firebase service account keys have been removed from this repository for security reasons.**

## Prerequisites
- Node.js 18+
- Python 3.11+
- Firebase CLI
- Vercel CLI
- Fly.io CLI

## 1. Firebase Setup

### Create Firebase Project
```bash
firebase login
firebase projects:create your-project-name
firebase use your-project-name
```

### Service Account Keys
Instead of committing keys to repo, use environment variables:

1. **For local development**: Create `.env.local`:
```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456

# Environment
VITE_FIREBASE_ENV=production  # or 'sandbox'
VITE_USE_SANDBOX=false

# API
VITE_API_BASE_URL=https://your-api.fly.dev
```

2. **For production deployments**: Set secrets in Vercel/Fly.io dashboards

### Database Rules
Deploy security rules:
```bash
firebase deploy --only database
```

## 2. API Setup (Fly.io)

### Deploy API
```bash
cd api
fly launch
fly deploy
```

### Environment Variables for API
Set in Fly.io secrets:
```bash
fly secrets set GOOGLE_APPLICATION_CREDENTIALS_JSON="$(cat path/to/service-account.json)"
fly secrets set FIREBASE_ENV=production
```

## 3. Frontend Setup (Vercel)

### Deploy Frontend
```bash
vercel --prod
```

### Environment Variables in Vercel
Set in Vercel dashboard:
- `VITE_FIREBASE_*` variables
- `VITE_API_BASE_URL`

## 4. CI/CD Setup (GitHub Actions)

### Enable Actions
Create `.github/workflows/deploy.yml`

### Required Secrets
In GitHub repo settings:
- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID`
- `FLY_API_TOKEN`
- `FIREBASE_SERVICE_ACCOUNT_JSON`

## 5. Local Development

### Install Dependencies
```bash
npm install
cd api && pip install -r requirements.txt
```

### Start Development
```bash
npm run dev          # Frontend (port 5173)
cd api && uvicorn main:app --reload  # API (port 8000)
```

## 6. Testing

```bash
npm run test:run     # Unit tests
npm run test:coverage # With coverage
```

## Security Checklist
- [ ] No credentials in version control
- [ ] Environment variables used for secrets
- [ ] Database rules deployed
- [ ] HTTPS enabled in production
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Input validation in place
