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