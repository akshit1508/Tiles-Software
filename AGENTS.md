# Tile Management System — AI Development Instructions

## Project

This is a web-based business management application for a tile business.

The application is used by the business owner to manage:

- Tile products
- Inventory
- Customers
- Orders
- Payments
- Outstanding amounts
- Sales
- Reports

## Technology Stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS

### Backend
- NestJS
- TypeScript

### Database
- MongoDB
- MongoDB Atlas for production

### Architecture

Frontend and backend are separate applications.

Frontend:
Next.js

Backend:
NestJS REST API

Database:
MongoDB

The frontend must communicate with the database only through the backend API.

The frontend must NEVER connect directly to MongoDB.

---

# Business Scope — V1

The application is for one shop.

There is only one user:

OWNER

The owner's brother is the only person who will use the system.

There are no staff accounts in V1.

There are no customer accounts in V1.

Customers do not log in.

There is NO public registration or signup endpoint in V1. Initial owner account provisioning is handled via `npm run seed:admin` using environment variables.

The application is internet-based and must work responsively on:

- Desktop
- Laptop
- Mobile

---

# Core Modules

The application will contain:

1. Authentication
2. Dashboard
3. Products
4. Inventory
5. Customers
6. Orders
7. Payments
8. Reports

---

# Product Information

Products contain:

- Brand
- Product Name
- Galla Number
- Category
- Size
- Finish
- Color
- Pieces Per Box
- Area Per Box
- Purchase Price
- Selling Price
- Minimum Stock
- Images

Current inventory quantity must be handled through the inventory system rather than treating it as ordinary product metadata.

Products must never be physically hard-deleted once created. Deletion operations must perform soft deactivation (`isActive = false`) to preserve historical consistency.

---

# Inventory

Inventory must support:

- Boxes
- Pieces
- Square Feet

Products may be sold by:

- Box
- Piece
- Square Feet

Inventory must support:

- Stock In
- Stock Out
- Damaged Stock
- Manual Adjustments
- Open/partial boxes
- Inventory history

The system must maintain enough information to determine why the current stock has its current value.

---

# Customers

Customer information:

- Name
- Phone
- Address
- Orders
- Payments
- Outstanding amount

Outstanding amount should be derived from order amounts and recorded payments rather than being manually trusted as an independent value.

---

# Orders

An order can contain multiple products.

An order may contain quantities measured in:

- Boxes
- Pieces
- Square Feet

Orders may be:

- Immediately paid
- Partially paid
- Credit / outstanding

Order statuses in V1 are strictly:
- `COMPLETED`
- `CANCELLED`

There is NO `DRAFT` status in V1.

Order numbers must follow the format `GT-YYYYMMDD-XXXX` and be generated atomically using a dedicated MongoDB counter document.

Order information should include:

- Order Number
- Customer
- Products
- Quantities
- Amount
- Payment information
- Outstanding amount
- Order status
- Date

---

# Payments

The system must support:

- Cash
- UPI
- Bank Transfer
- Cheque

Partial payments are supported.

A customer/order can have multiple payment records.

Payment history must be preserved.

---

# Security Rules

Never:

- Store plaintext passwords
- Expose passwords or password hashes through APIs
- Store secrets in source code
- Commit .env files
- Expose server secrets to the browser
- Trust frontend authorization
- Allow unauthorized API access
- Connect the frontend directly to MongoDB
- Disable authentication to make development easier
- Remove security checks simply to make tests pass

All external input must be validated.

Authorization must be enforced on the backend.

Production communication must use HTTPS.

Authentication credentials must use secure storage and transport.

---

# AI Agent Rules

Before implementing a task:

1. Read this file.
2. Read the relevant documentation in /docs.
3. Inspect the existing implementation.
4. Identify affected files.
5. Explain the proposed implementation.
6. Identify security implications.
7. Identify required tests.

Do not modify unrelated modules.

Do not change architecture without explicit approval.

Do not introduce a new library when an existing project dependency can solve the problem.

Do not rewrite working code unnecessarily.

Prefer small, reviewable changes.

After implementation:

1. Run tests.
2. Run TypeScript checks.
3. Run linting.
4. Verify the build when appropriate.
5. Report changed files.
6. Report tests performed.
7. Report remaining risks or TODOs.

Never claim a task is complete without verification.

---

# Database Rules

MongoDB is the source of persistent application data.

Database access must occur through the NestJS backend.

Database credentials must remain server-side.

Schema/model changes must be documented.

Do not delete or migrate production data without explicit approval.

Important business records such as orders, payments, and inventory movements must not be silently destroyed.

---

# Git Rules

Never work directly on main for a significant feature.

Use feature branches.

Review the diff before committing.

Do not commit:

- .env
- secrets
- credentials
- production database dumps

Keep commits focused and descriptive.

---

# Important Development Principle

The AI agent is an implementation assistant.

The project documentation and approved architecture are the source of truth.

Do not invent business rules.

If a requirement is ambiguous and affects architecture, database behavior, security, or financial calculations, stop and ask for clarification.