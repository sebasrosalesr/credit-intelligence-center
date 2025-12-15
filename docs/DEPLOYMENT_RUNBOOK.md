# Deployment Runbook

## Overview
This document outlines the procedures for deploying the Credit Intelligence Center application to production and staging environments.

## Environments

### Production Environment
- **Frontend**: Vercel (creditintelligence.app)
- **Backend**: Fly.io (api.creditintelligence.app)
- **Database**: Firebase Realtime Database
- **Monitoring**: Sentry, GitHub Actions

### Staging Environment
- **Frontend**: Vercel (staging.creditintelligence.app)
- **Backend**: Fly.io (staging-api.creditintelligence.app)
- **Database**: Firebase Realtime Database (sandbox)
- **Monitoring**: Sentry, GitHub Actions

## Prerequisites

### Required Accounts
- [ ] GitHub repository access
- [ ] Vercel account with Pro plan
- [ ] Fly.io account
- [ ] Firebase project access
- [ ] Sentry account

### Required Secrets
Set these in GitHub repository settings under "Secrets and variables > Actions":

```
VERCEL_TOKEN
VERCEL_PROJECT_ID
VERCEL_ORG_ID
FLY_API_TOKEN
FIREBASE_SERVICE_ACCOUNT_JSON (production)
FIREBASE_SANDBOX_SERVICE_ACCOUNT_JSON (staging)
SENTRY_DSN
```

## Deployment Procedures

### Automated Deployment (Recommended)

#### Production Deployment
1. **Create Release Branch**
   ```bash
   git checkout -b release/v1.2.3
   git push origin release/v1.2.3
   ```

2. **Create Pull Request**
   - Base: `main`
   - Compare: `release/v1.2.3`
   - Title: "Release v1.2.3"

3. **Merge to Main**
   - GitHub Actions automatically triggers production deployment
   - Monitor deployment in Actions tab
   - Check Vercel and Fly.io dashboards

#### Staging Deployment
```bash
git push origin staging
```

### Manual Deployment (Fallback)

#### Frontend Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Deploy production
vercel --prod

# Deploy staging
vercel --yes
```

#### Backend Deployment
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy production
cd api
fly deploy

# Deploy staging
fly deploy --config fly.staging.toml
```

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests pass (`npm run test:run`)
- [ ] TypeScript compilation succeeds (`npx tsc --noEmit`)
- [ ] Linting passes (`npm run lint`)
- [ ] Security scan clean (Trivy)

### Configuration
- [ ] Environment variables set
- [ ] Firebase rules deployed
- [ ] Database indexes created
- [ ] CORS origins configured

### Documentation
- [ ] API documentation updated
- [ ] Environment setup documented
- [ ] Deployment runbook current
- [ ] Changelog updated

## Post-Deployment Verification

### Frontend Checks
- [ ] Application loads without errors
- [ ] Authentication works
- [ ] All tabs accessible
- [ ] File uploads functional

### Backend Checks
- [ ] Health endpoint responds: `GET /health`
- [ ] API endpoints functional
- [ ] Rate limiting working
- [ ] Error logging active

### Database Checks
- [ ] Firebase rules active
- [ ] Data integrity maintained
- [ ] Backup procedures running

### Monitoring Setup
- [ ] Sentry error tracking active
- [ ] Performance monitoring enabled
- [ ] Uptime monitoring configured

## Rollback Procedures

### Frontend Rollback
```bash
# Using Vercel CLI
vercel rollback

# Or via Vercel dashboard
# Go to Deployments > Select previous deployment > Rollback
```

### Backend Rollback
```bash
# Deploy previous image
fly deploy --image <previous-image-tag>

# Or redeploy from Git
git revert HEAD~1
git push origin main
```

### Database Rollback
1. **Firebase Backup**: Restore from automatic backup
2. **Manual**: Use Firebase Admin SDK to restore data
3. **Emergency**: Contact Firebase support

## Monitoring & Alerting

### Error Monitoring
- **Sentry**: Automatic error tracking
- **GitHub Issues**: Create issues for critical errors
- **Email Alerts**: Configure in monitoring dashboard

### Performance Monitoring
- **Sentry**: Performance metrics
- **Firebase**: Database performance
- **Vercel**: Frontend performance
- **Fly.io**: Backend metrics

### Uptime Monitoring
- **UptimeRobot**: External monitoring
- **Fly.io**: Built-in health checks
- **Vercel**: Deployment monitoring

## Incident Response

### Severity Levels
1. **Critical**: Service completely down
2. **High**: Major functionality broken
3. **Medium**: Minor features affected
4. **Low**: Cosmetic issues

### Response Times
- **Critical**: < 15 minutes
- **High**: < 1 hour
- **Medium**: < 4 hours
- **Low**: < 24 hours

### Communication
1. **Internal**: Slack/Discord notification
2. **External**: Status page update
3. **Customers**: Email notification for critical issues

## Maintenance Procedures

### Regular Tasks
- **Weekly**: Review error logs
- **Monthly**: Update dependencies
- **Quarterly**: Security audit
- **Annually**: Infrastructure review

### Security Updates
1. **Monitor**: Dependabot alerts
2. **Test**: Security patches in staging
3. **Deploy**: During low-traffic windows
4. **Verify**: No regressions introduced

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check Node.js version
node --version

# Clear cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### Deployment Failures
```bash
# Check secrets
gh secret list

# Check Vercel/Fly.io status
vercel --debug
fly status
```

#### Database Issues
```bash
# Check Firebase rules
firebase deploy --only database

# Verify connectivity
firebase functions:log
```

### Support Contacts
- **Frontend**: Vercel Support
- **Backend**: Fly.io Support
- **Database**: Firebase Support
- **Monitoring**: Sentry Support

## Security Considerations

### Secrets Management
- Never commit secrets to code
- Rotate secrets quarterly
- Use GitHub secrets for CI/CD
- Environment-specific secrets

### Access Control
- Least privilege principle
- Regular access reviews
- Multi-factor authentication required
- Audit logging enabled

### Compliance
- Data encryption in transit and at rest
- Regular security scans
- GDPR compliance for EU users
- SOC 2 compliance maintained
