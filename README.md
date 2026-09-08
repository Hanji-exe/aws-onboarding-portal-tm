```markdown
# AWS Marketplace Onboarding Portal — Test Environment

## Overview
Local test environment for the `/aws-onboarding` fulfillment webhook. Backend built in Node.js, tested with Jest, ready for AWS deployment.

## What This Does
When a buyer purchases Taskmaster HIaaS on AWS Marketplace, AWS redirects them to our onboarding page with a token. This backend:

- Receives the `x-amzn-marketplace-token` via POST request
- Validates the token format and request structure
- Calls AWS ResolveCustomer API to identify the buyer
- Returns `CustomerIdentifier` + `ProductCode` to complete onboarding
- Zero data retention — no tokens or PII are stored or logged

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | v22.17.1 | JavaScript runtime |
| npm | 11.4.2 | Package manager |
| Docker | 28.3.2 | Container runtime for SAM |
| SAM CLI | 1.166.1 | Local Lambda simulation |
| Jest | 29.x | Testing framework |
| AWS SDK v3 | 3.x | Marketplace Metering API |

## Project Structure

```
aws-onboarding-portal-tm/
├── src/
│   ├── handlers/
│   │   └── onboarding.js       ← Main Lambda handler (entry point)
│   ├── services/
│   │   └── marketplace.js      ← AWS Marketplace ResolveCustomer API
│   └── utils/
│       └── validator.js        ← Token extraction & validation
├── tests/
│   └── unit/
│       └── onboarding.test.js  ← Jest test suite (11 tests)
├── events/
│   ├── valid-token.json        ← Mock: valid marketplace token
│   ├── missing-token.json      ← Mock: no token in body
│   ├── empty-body.json         ← Mock: null request body
│   └── wrong-method.json       ← Mock: GET instead of POST
├── package.json
└── README.md
```

## Quick Start

```bash
# 1. Clone and enter the project
cd aws-onboarding-portal-tm

# 2. Install dependencies
npm install

# 3. Run all tests
npm test

# 4. Run tests in watch mode (re-runs on file changes)
npm run test:watch
```

## Test Coverage

All 11 tests passing ✅

| # | Test Scenario | Expected Status | Result |
|---|---------------|-----------------|--------|
| 1 | Valid token → onboarding success | 200 OK | ✅ Pass |
| 2 | Missing token in body | 400 Bad Request | ✅ Pass |
| 3 | Null/empty body | 400 Bad Request | ✅ Pass |
| 4 | Malformed JSON body | 400 Bad Request | ✅ Pass |
| 5 | Empty string token | 400 Bad Request | ✅ Pass |
| 6 | Wrong HTTP method (GET) | 405 Not Allowed | ✅ Pass |
| 7 | Expired token | 410 Gone | ✅ Pass |
| 8 | Invalid token | 401 Unauthorized | ✅ Pass |
| 9 | AWS API failure | 503 Unavailable | ✅ Pass |
| 10 | CORS + security headers | Correct headers | ✅ Pass |
| 11 | Response body format | JSON string | ✅ Pass |

```
Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
Snapshots:   0 total
Time:        8.027 s
```

## API Specification

### `POST /aws-onboarding`

**Request:**

```json
{
  "x-amzn-marketplace-token": "token-from-aws-marketplace"
}
```

**Success Response (200):**

```json
{
  "message": "Onboarding successful",
  "customerIdentifier": "cust-abc-123",
  "productCode": "taskmaster-hiaas-prod"
}
```

**Error Responses:**

| Status | When | Response Body |
|--------|------|----------------|
| 400 | Token missing or invalid | `{ "error": "Missing x-amzn-marketplace-token" }` |
| 401 | Token rejected by AWS | `{ "error": "Invalid marketplace token." }` |
| 405 | Wrong HTTP method | `{ "error": "Method not allowed. Use POST." }` |
| 410 | Token expired | `{ "error": "Token has expired. Please re-purchase." }` |
| 503 | AWS API unavailable | `{ "error": "Service temporarily unavailable." }` |

**Response Headers (all responses):**

```
Content-Type: application/json
Access-Control-Allow-Origin: *
X-Content-Type-Options: nosniff
Cache-Control: no-store
```

## Architecture

### Production Flow

```
Buyer purchases on AWS Marketplace
        ↓
AWS generates x-amzn-marketplace-token
        ↓
Buyer redirected to landing page
        ↓
Landing page POSTs token to API Gateway
        ↓
API Gateway → Lambda (onboarding.handler)
        ↓
Lambda extracts token from POST body
        ↓
Lambda calls ResolveCustomer API with token
        ↓
AWS returns CustomerIdentifier + ProductCode
        ↓
Lambda returns success response to buyer
        ↓
All data discarded (zero-data-retention)
```

### Local Test Flow

```
Jest test runner / cURL
        ↓
Calls handler() directly with mock event
        ↓
Handler processes request (same code as production)
        ↓
marketplace.js is mocked (jest.mock)
        ↓
Returns fake CustomerIdentifier
        ↓
Test asserts response is correct
```

### AWS Services Required (Production)

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| API Gateway (HTTP API) | Receives POST requests | 1M requests/month free |
| Lambda (Node.js 20.x) | Executes handler logic | 1M requests/month free |
| Marketplace Metering | ResolveCustomer API | No direct cost |
| IAM | Least-privilege permissions | Free |
| CloudWatch | Operational logging | 5GB/month free |

## Security

- **Zero data retention** — No tokens, customer IDs, or PII are stored anywhere. Data exists only in Lambda's ephemeral memory during request processing.
- **Sanitized logs** — Only operational messages logged (e.g., "request received", "resolved successfully"). Token values are NEVER logged.
- **Security headers** — `X-Content-Type-Options: nosniff` prevents MIME sniffing. `Cache-Control: no-store` prevents caching of sensitive responses.
- **Input validation** — All inputs validated before processing. Malformed JSON, missing fields, and empty values are rejected immediately.
- **Least privilege IAM** — Lambda role only has permission to call `marketplace-metering:ResolveCustomer`. No access to any other AWS service.
- **Method restriction** — Only POST requests accepted. GET, PUT, DELETE return 405.

## File Descriptions

**`src/handlers/onboarding.js`**
The main Lambda handler. Entry point that AWS Lambda calls. Orchestrates the entire flow: validates HTTP method → extracts token → calls ResolveCustomer → returns response. Contains the `buildResponse()` helper that adds security headers to every response.

**`src/services/marketplace.js`**
AWS SDK wrapper that creates a `MarketplaceMeteringClient` and sends a `ResolveCustomerCommand`. Isolated in its own module so it can be mocked entirely in tests. In production, this calls the real AWS API. In tests, Jest replaces this with fake responses.

**`src/utils/validator.js`**
Pure function that extracts and validates the `x-amzn-marketplace-token` from the request body. Handles all edge cases: null body, missing token, empty string, malformed JSON. Returns a structured object: `{ valid, token, error }`.

**`tests/unit/onboarding.test.js`**
Jest test suite with 11 test cases organized into 5 categories: Success Cases, Token Validation Errors, HTTP Method Validation, ResolveCustomer API Errors, and Response Format. Uses `jest.mock()` to replace the marketplace service with controlled fake responses.

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| Serverless (Lambda) over EC2 | Zero idle cost. Endpoint only runs when a buyer purchases. |
| HTTP API over REST API | 71% cheaper ($1/M vs $3.50/M requests). Simple POST doesn't need REST features. |
| Separate marketplace.js module | Enables complete mocking in tests. Handler doesn't know if API is real or fake. |
| 256MB Lambda memory | Sufficient for JSON parsing + one API call. 50% cheaper than 512MB default. |
| Local-first development | Budget pending. Build and test now, deploy instantly when approved. |
| Node.js 20.x runtime | LTS version supported by Lambda. Matches local Node.js v22 (backward compatible). |
```