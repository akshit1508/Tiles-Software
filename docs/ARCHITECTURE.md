# System Architecture

## Overview

The application is structured as a TypeScript monorepo with distinct decoupled components:

1. **Frontend (`apps/web`)**: Next.js (App Router) + Tailwind CSS web dashboard accessible on desktop, laptop, and mobile browsers.
2. **Backend (`apps/api`)**: NestJS REST API encapsulating all business logic, validation, unit conversion, and authentication.
3. **Database**: MongoDB (Atlas for production) accessed strictly via Mongoose from the NestJS backend.

## Architecture Flow

```
Browser
   ↓ (HTTPS)
Next.js Web Application (apps/web)
   ↓ (HTTPS REST API / JSON + HttpOnly Cookies)
NestJS Backend (apps/api)
   ↓ (Mongoose / MongoDB Driver with ACID Transactions)
MongoDB Atlas
```

## Critical System Boundaries

1. **Direct Database Isolation**: The frontend never connects directly to MongoDB. All data access must pass through NestJS.
2. **Authentication Boundary**: Single owner account, authenticated via secure HttpOnly JWT cookies. No public registration endpoint; initial account provisioned via `npm run seed:admin`.
3. **Transactional Integrity**:
   - Order creation, stock deduction, and inventory transaction recording execute in an atomic MongoDB multi-document transaction.
   - Order numbers (`GT-YYYYMMDD-XXXX`) are atomically generated via a dedicated MongoDB sequence counter to prevent duplicates under concurrency.
   - Order cancellation and inventory reversal (`SALE_REVERSAL`) execute atomically and idempotently.
4. **Data Preservation**: Products and customers are soft-deactivated (`isActive: false`). Historical orders, payments, and inventory transactions are permanent audit records.