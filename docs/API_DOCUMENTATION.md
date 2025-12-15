# API Documentation

## Overview
The Credit Intelligence Center API provides endpoints for processing credit requests, managing data ingestion, and performing analytics operations.

## Base URL
- Production: `https://your-api.fly.dev`
- Staging: `https://staging-api.fly.dev`

## Authentication
All endpoints require Firebase authentication. Include the Firebase ID token in the Authorization header:
```
Authorization: Bearer <firebase-id-token>
```

## Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "ok": true
}
```

### File Upload Endpoints

#### Requestor Template Upload
```http
POST /ingestion/requestor-upload
Content-Type: multipart/form-data

file: <uploaded_file>
```

**Rate Limit:** 10 requests/minute
**Supported Formats:** Excel (.xlsx, .xls), CSV

**Response:**
```json
{
  "format": "macro_template",
  "rows_count": 150,
  "columns": ["Date", "Invoice Number", "Item Number", ...],
  "validation_issues": []
}
```

#### AI Intake Engine
```http
POST /ingestion/ai-intake
Content-Type: multipart/form-data

requestor_file: <uploaded_file>
billing_file: <uploaded_file>
mapping_file: <uploaded_file> (optional)
ticket_number: string
ticket_date: string (optional)
status: string
dry_run: boolean
```

**Rate Limit:** 5 requests/minute

**Response:**
```json
{
  "mode": "reconciliation_successful",
  "requestor_format": "standard_template",
  "dry_run": false,
  "df_std": [...],
  "matches": [...],
  "input_preview": [...],
  "stats": {
    "total_rows": 150,
    "matched_rows": 120,
    "unmatched_rows": 30
  }
}
```

#### Push Edited Records
```http
POST /ingestion/ai-intake/push
Content-Type: application/json

{
  "rows": [...],
  "ticket_number": "TICKET-123",
  "ticket_date": "2024-01-15",
  "status": "Open",
  "dry_run": false
}
```

**Response:**
```json
{
  "dry_run": false,
  "submitted": 25,
  "skipped_duplicates": 2,
  "failed": 0,
  "details": [
    "Successfully pushed 25 records",
    "Skipped 2 duplicate records"
  ]
}
```

#### Sync Credit Numbers
```http
POST /ingestion/sync-cr-numbers
Content-Type: multipart/form-data

billing_file: <uploaded_file>
dry_run: boolean
```

**Rate Limit:** 5 requests/minute

**Response:**
```json
{
  "checked": 500,
  "matched": 45,
  "updated": 45,
  "dry_run": false,
  "sample_updates": [...]
}
```

#### PDF Invoice Parser
```http
POST /ingestion/pdf-invoice
Content-Type: multipart/form-data

pdf_file: <uploaded_file>
prefer_account_code: boolean
```

**Rate Limit:** 10 requests/minute

**Response:**
```json
{
  "row_count": 25,
  "rows": [...],
  "matches": [...],
  "firebase_warnings": []
}
```

#### Billing vs Credit Reconciliation
```http
POST /ingestion/billing-vs-credit
Content-Type: multipart/form-data

credit_file: <uploaded_file>
billing_file: <uploaded_file>
mapping_file: <uploaded_file> (optional)
```

**Response:**
```json
{
  "reconciled_rows": 200,
  "matches_found": 180,
  "discrepancies": 20,
  "data": [...]
}
```

## Error Responses

### Rate Limiting
```json
{
  "detail": "Request was denied due to rate limiting."
}
```

### Validation Error
```json
{
  "detail": "Data validation failed with 5 issues:\n• Row 1: Missing required field 'Date'\n• Row 3: Invalid date format..."
}
```

### Authentication Error
```json
{
  "detail": "Authentication required"
}
```

## Rate Limits

| Endpoint | Rate Limit | Burst |
|----------|------------|-------|
| `/requestor-upload` | 10/minute | 2 |
| `/ai-intake` | 5/minute | 1 |
| `/sync-cr-numbers` | 5/minute | 1 |
| `/pdf-invoice` | 10/minute | 2 |
| `/billing-vs-credit` | 10/minute | 2 |

## File Format Requirements

### Excel Files
- Supported: .xlsx, .xls
- Maximum size: 50MB
- Required columns vary by endpoint

### CSV Files
- UTF-8 encoding
- Comma-separated
- Maximum size: 100MB
- Headers required

### PDF Files
- Standard invoice formats
- Maximum size: 25MB
- Text-extractable content required

## Data Validation Rules

### Required Fields (Credit Requests)
- Date
- Invoice Number
- Item Number
- Credit Request Total

### Data Types
- Date: YYYY-MM-DD format
- Numbers: Decimal values, no currency symbols
- Strings: Max 255 characters, no special characters

### Business Rules
- Credit totals must be positive
- Invoice numbers must be unique per item
- Dates cannot be in the future

## Monitoring

### Health Checks
The API includes comprehensive health monitoring:
- Database connectivity
- File upload processing
- Rate limiting status
- Memory usage

### Error Tracking
All errors are automatically logged to Sentry with:
- Stack traces
- User context
- Request details
- Performance metrics

## Deployment

### Environment Variables
```bash
# Database
FIREBASE_CREDENTIALS_JSON=<service_account_json>
FIREBASE_ENV=production

# Security
SECRET_KEY=<random_string>

# Monitoring
SENTRY_DSN=<sentry_dsn>
```

### Scaling
- Horizontal scaling supported
- Stateless design
- Database connection pooling
- CDN integration recommended for file uploads
