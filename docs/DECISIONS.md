# Architecture Decision Records

## ADR-001 — Application Type

Status: Accepted

Decision:

Build the system as a web-based business application.

Reason:

The owner needs access from both desktop/laptop and mobile devices.

The application will be internet-based.

---

## ADR-002 — Database

Status: Accepted

Decision:

Use MongoDB as the application database.

Production database will use MongoDB Atlas.

Reason:

MongoDB is the selected database technology for this project.

---

## ADR-003 — Frontend

Status: Accepted

Decision:

Use Next.js with TypeScript.

---

## ADR-004 — Backend

Status: Accepted

Decision:

Use NestJS with TypeScript.

---

## ADR-005 — V1 Users

Status: Accepted

Decision:

Only the business owner will have an account.

No staff accounts in V1.

Customers do not login.

---

## ADR-006 — Application Access

Status: Accepted

Decision:

Internet-based application accessible through desktop and mobile browsers.

---

## ADR-007 — Inventory Units

Status: Accepted

Decision:

Inventory must support:

- Boxes
- Pieces
- Square Feet

Products can be sold using any of these three units.

---

## ADR-008 — Partial Boxes

Status: Accepted

Decision:

The system must support opened boxes and loose pieces.

---

## ADR-009 — Payments

Status: Accepted

Decision:

Support:

- Cash
- UPI
- Bank Transfer
- Cheque

Multiple/partial payments are supported.

---

## ADR-010 — Customer Pricing

Status: Accepted

Decision:

V1 does not contain customer-specific pricing tiers.

Applicable transaction amount is recorded at order time.

---

## ADR-011 — Order Statuses in V1

Status: Accepted

Decision:

In V1, order statuses are strictly limited to:
- `COMPLETED`
- `CANCELLED`

No `DRAFT` or intermediate order status is permitted. An order is created directly in `COMPLETED` status upon completing a sale.

Reason:

Simplifies business logic and aligns with the single-operator counter workflow where orders are finalized at transaction time.

---

## ADR-012 — Product Soft Deactivation

Status: Accepted

Decision:

Products must never be physically hard-deleted from the database once created. Any deletion request (including `DELETE /products/:id`) must operate as a soft deactivation:
`isActive = false`

Reason:

Preserves audit integrity and historical consistency across existing orders, payments, and inventory transactions.

---

## ADR-013 — Atomic Order Number Generation

Status: Accepted

Decision:

Order numbers must follow the format `GT-YYYYMMDD-XXXX` and be generated atomically using a dedicated MongoDB counter document (via `findOneAndUpdate` with `$inc`).

Reason:

Guarantees sequential, gap-free, and collision-proof order numbering even under concurrent order creation requests.

---

## ADR-014 — Initial Owner Account Provisioning

Status: Accepted

Decision:

The single owner account in V1 will be provisioned exclusively via a dedicated NestJS CLI seed command:
`npm run seed:admin`
reading `ADMIN_EMAIL` and `ADMIN_PASSWORD` from environment variables. There is no public registration or signup endpoint in V1.

Reason:

Enforces strict access control for the private single-shop application and prevents unauthorized registration attempts.

---

## ADR-015 — Dedicated Order Cancellation Command Endpoint

Status: Accepted

Decision:

Order cancellation is executed via a dedicated business command endpoint:
`POST /orders/:id/cancel`
Generic order updates via `PATCH /orders/:id` are not supported.

The atomic cancellation flow:
1. Verify order is currently `COMPLETED`.
2. Restore exact consumed `physicalPieces` to `inventories`.
3. Create `SALE_REVERSAL` inventory transaction.
4. Update status to `CANCELLED`.
5. Commit atomically.

Cancellation is strictly idempotent: a second cancellation attempt will not restore inventory again.

Reason:

Treats cancellation as an explicit domain business action rather than generic resource modification, ensuring rigorous transactional and stock restoration guarantees.