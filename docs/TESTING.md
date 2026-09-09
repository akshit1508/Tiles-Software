# Testing Strategy

## Backend

Use:

- Unit tests
- Integration tests
- End-to-end tests

Important areas:

- Authentication
- Authorization
- Product validation
- Inventory calculations
- Partial boxes
- Stock availability
- Orders
- Payments
- Outstanding calculations
- Reports

---

# Frontend

Test:

- Forms
- Validation
- API integration
- Loading states
- Error states
- Important user workflows

---

# Critical Scenarios

## Inventory

Test:

- Box sale
- Piece sale
- Square-foot sale
- Partial box
- Damaged stock
- Insufficient stock

## Payments

Test:

- Full payment
- Partial payment
- Multiple payments
- Outstanding balance

## Security & System Integrity

Test:

- Unauthenticated API access
- Unauthorized access
- Invalid input validation
- Authentication abuse / rate limiting
- Owner seed script execution (`npm run seed:admin`)
- Prevention of public registration/signup

## Orders & Concurrency

Test:

- Atomic order number generation under concurrent requests (no duplicate `GT-YYYYMMDD-XXXX`)
- Strict order status transitions (only `COMPLETED` permitted on create, only `CANCELLED` on cancellation)
- Rejection of invalid status transitions (e.g. `DRAFT` or re-activating `CANCELLED`)
- Order cancellation command (`POST /orders/:id/cancel`) idempotency (cancelling twice does not duplicate stock restoration)
- Exact stock restoration via `SALE_REVERSAL` transaction
- Product soft-deactivation (`DELETE /products/:id` sets `isActive: false` and preserves historical orders/movements)