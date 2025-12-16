# Credit Intelligence Center (CIC)

A production-ready credit processing and analytics platform built with React, FastAPI, and Firebase. Features automated data ingestion, AI-powered reconciliation, real-time dashboards, and comprehensive monitoring.

## 🚀 Features

### Core Functionality
- **AI Intake Engine**: Automated credit request processing with billing reconciliation
- **Multi-format Support**: Excel, CSV, and PDF file processing
- **Real-time Dashboards**: Live credit analytics and KPIs
- **Role-based Access Control**: Owner, Credit, Manager, and Read-only roles
- **Audit Trail**: Complete logging of all user actions

### Enterprise Security
- **Firebase Authentication**: Secure user management
- **Database Security Rules**: Granular access control
- **API Rate Limiting**: DDoS protection with SlowAPI
- **Input Validation**: Comprehensive data sanitization
- **Audit Logging**: Compliance-ready activity tracking

### Production Infrastructure
- **Automated CI/CD**: GitHub Actions with multi-environment support
- **Monitoring & Alerting**: Sentry error tracking and performance monitoring
- **Auto-scaling Backend**: Fly.io with horizontal scaling
- **Global CDN**: Vercel edge network for optimal performance

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│    │ FastAPI Backend │    │ Firebase RT     │
│     (Vercel)    │◄──►│     (Fly.io)    │◄──►│    Database     │
│                 │    │                 │    │                 │
│ • Dashboard     │    │ • File Processing│   │ • Credit Records│
│ • File Upload   │    │ • AI Reconciliation│ │ • User Roles    │
│ • Real-time     │    │ • Rate Limiting │    │ • Audit Logs    │ 
│ • Error Tracking│    │ • Health Checks │    │ • Reminders     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** for build tooling
- **Tremor** for data visualization
- **Firebase Auth** for authentication
- **Sentry** for error tracking

### Backend
- **FastAPI** with Python 3.11
- **Pandas** for data processing
- **SlowAPI** for rate limiting
- **Firebase Admin SDK**

### Infrastructure
- **Vercel**: Frontend hosting and CDN
- **Fly.io**: Backend hosting and scaling
- **Firebase**: Database and authentication
- **GitHub Actions**: CI/CD pipelines

## 📋 Prerequisites

- Node.js 18+
- Python 3.11+
- Firebase CLI
- Vercel CLI
- Fly.io CLI

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone <repository-url>
cd credit-intelligence-center

# Install frontend dependencies
npm install

# Install backend dependencies
cd api && pip install -r requirements.txt
```

### 2. Environment Setup
```bash
# Copy environment files
cp .env.example .env.local
cp api/.env.example api/.env

# Configure your environment variables
# See docs/ENVIRONMENT_SETUP.md for details
```

### 3. Firebase Setup
```bash
firebase login
firebase use your-project-id
firebase deploy --only database
```

### 4. Development
```bash
# Start frontend (port 5173)
npm run dev

# Start backend (port 8000)
cd api && uvicorn main:app --reload
```

## 📁 Project Structure

```
.
├── src/                    # React frontend
│   ├── components/         # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   ├── monitoring/        # Error tracking & logging
│   ├── utils/             # Helper functions
│   └── types/             # TypeScript definitions
├── api/                   # FastAPI backend
│   ├── routes_ingestion.py # API endpoints
│   ├── config/            # Configuration
│   └── main.py            # Application entry point
├── docs/                  # Documentation
│   ├── API_DOCUMENTATION.md
│   ├── DEPLOYMENT_RUNBOOK.md
│   └── ENVIRONMENT_SETUP.md
├── .github/workflows/     # CI/CD pipelines
└── functions/             # Firebase Cloud Functions
```

## 🔒 Security

### Authentication & Authorization
- Firebase Authentication with custom claims
- Role-based access control (Owner, Credit, Manager, Read-only)
- Session management with automatic refresh

### Data Protection
- End-to-end encryption for sensitive data
- Firebase security rules with field-level permissions
- Input validation and sanitization
- Rate limiting on all endpoints

### Compliance
- SOC 2 compliant architecture
- GDPR-ready data handling
- Audit logging for all user actions
- Regular security scans

## 📊 Monitoring & Observability

### Error Tracking
- **Sentry**: Real-time error monitoring with context
- **Performance**: Core Web Vitals tracking
- **User Context**: Role and session information

### Health Monitoring
- **API Health Checks**: `/health` endpoint
- **Database Connectivity**: Automatic monitoring
- **Rate Limiting Status**: Real-time metrics

### Logging
- **Structured Logging**: JSON format with correlation IDs
- **Log Levels**: ERROR, WARN, INFO, DEBUG
- **Retention**: Configurable log retention policies

## 🚢 Deployment

### Automated (Recommended)
```bash
# Production deployment
git checkout -b release/v1.0.0
git push origin release/v1.0.0
# Create PR and merge to main

# Staging deployment
git push origin staging
```

### Manual Deployment
```bash
# Frontend
npm i -g vercel
vercel --prod

# Backend
fly deploy
```

See `docs/DEPLOYMENT_RUNBOOK.md` for detailed procedures.

## 🧪 Testing

```bash
# Unit tests
npm run test:run

# With coverage
npm run test:coverage

# Type checking
npx tsc --noEmit

# E2E tests (future)
npm run test:e2e
```

## 📚 Documentation

- **[API Documentation](docs/API_DOCUMENTATION.md)**: Complete API reference
- **[Environment Setup](docs/ENVIRONMENT_SETUP.md)**: Configuration guide
- **[Deployment Runbook](docs/DEPLOYMENT_RUNBOOK.md)**: Production deployment procedures

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📝 License

This project is proprietary software. See LICENSE file for details.

## 🚦 Status

[![CI/CD](https://github.com/your-org/credit-intelligence-center/actions/workflows/deploy.yml/badge.svg)](https://github.com/your-org/credit-intelligence-center/actions/workflows/deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100-green.svg)](https://fastapi.tiangolo.com/)

**Current Version**: 1.0.0
**Environment**: Production Ready
