# Business Rules

## Shop

- There is one shop.
- There is one owner/user in V1.
- Customers do not login.

---

# Tile Units

Inventory supports three units:

1. Boxes
2. Pieces
3. Square Feet

A product defines:

- Pieces per box
- Area per box

These values allow conversion between units.

---

# Selling Units

A product can be sold by:

- Box
- Piece
- Square Feet

The system must preserve accurate inventory when a sale is made in any supported unit.

---

# Partial Boxes

Opened boxes must be supported.

Example:

If:

1 box = 4 pieces

and 3 pieces are sold from a box,

the remaining loose piece must remain trackable.

The system must not incorrectly treat the entire box as consumed.

---

# Damaged Stock

Damaged/broken tiles must be recorded as inventory movements.

Damaged quantities must reduce available stock.

The system must preserve the reason/history for stock changes.

---

# Stock History

Important inventory changes must create a history record.

Examples:

- Purchase / Stock In
- Sale / Stock Out
- Damage
- Manual Adjustment

The system should make it possible to understand why current inventory changed.

---

# Orders

One order can contain multiple products.

An order belongs to one customer.

Orders can be fully paid, partially paid, or unpaid/credit.

### Order Status
In V1, there are strictly two allowed order statuses:
- `COMPLETED`: Sale is confirmed and physical inventory is deducted.
- `CANCELLED`: Sale is cancelled and physical inventory is restored via `SALE_REVERSAL`.

There is NO `DRAFT` status in V1.

### Order Numbers
Every order receives an identifier formatted as:
`GT-YYYYMMDD-XXXX` (e.g. `GT-20260909-0001`).
Order numbers are generated using an atomic MongoDB counter mechanism to prevent race conditions or duplicate sequence numbers during concurrent order creation.

---

# Product Deactivation

Products must never be hard-deleted once created.

Deactivation must operate as a soft deactivation:
`isActive = false`

Physical deletion of products that have historical references (inventory, transactions, or orders) is strictly forbidden to preserve business history.

---

# User Provisioning

The single owner account in V1 is provisioned exclusively through a dedicated CLI seed command:
`npm run seed:admin`

This command reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from environment variables and creates or updates the owner account with a securely hashed password.
There is NO public registration or signup endpoint in V1.

---

# Payments

A customer may pay:

- Cash
- UPI
- Bank Transfer
- Cheque

A single order can have multiple payments.

---

# Outstanding Amount

Outstanding amount should be derived from:

Order Amount - Payments

The system should not rely solely on manually entered outstanding values.

---

# Pricing

There is no customer-specific pricing system in V1.

There are no customer pricing tiers.

The application does not need:

- Customer-specific price lists
- Wholesale price tiers
- Retail price tiers

The business owner will record the applicable order amount during the transaction.

---

# Reports

Sales reports must use recorded order/payment data rather than manually maintained totals.

All financial calculations must be performed consistently by the backend.