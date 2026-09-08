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