Goverdhan Traders — Production Database Design

1. Purpose

This document defines the production database architecture for the Goverdhan Traders Tile Management System.

The database must support:

Authentication for the shop owner

Tile product management

Physical inventory tracking

Customers

Orders containing multiple products

Partial/full payments

Outstanding amounts

Inventory movement history

Sales and reporting

This document is the database source-of-truth for implementation. The AI agent must follow it and must not invent a conflicting data model.

2. Technology

Production database:

MongoDB Atlas

Backend:

NestJS + Mongoose

Application flow:

Browser
   ↓ HTTPS
Next.js Web Application
   ↓ HTTPS REST API
NestJS API
   ↓ Mongoose
MongoDB Atlas

The browser/frontend must NEVER connect directly to MongoDB.

MongoDB credentials, connection strings, and database access must remain server-side.

3. V1 Collections

The V1 database contains these seven collections:

users
products
inventories
customers
orders
payments
inventory_transactions

Collection responsibilities

Collection

Responsibility

users

Authentication and owner account

products

Tile/product master data

inventories

Current physical stock state

customers

Customer master data

orders

Historical sales/order documents

payments

Individual payment transactions

inventory_transactions

Immutable-ish inventory movement history

No additional collection should be introduced without a clear business or architectural reason and documentation in DECISIONS.md.

4. General Data Rules

4.1 IDs

MongoDB ObjectId is the default identifier type for persisted documents and references unless implementation has a documented reason to use another identifier.

4.2 Timestamps

All primary business documents should contain:

createdAt
updatedAt

Business-event documents such as payments and inventory transactions should also contain their event date/time where required.

Store timestamps consistently in UTC at the database/application boundary. Display local Indian time in the UI when required.

4.3 Money

Money must not rely on JavaScript floating-point arithmetic for persisted financial values.

MongoDB/Mongoose should use:

Decimal128

for monetary fields such as:

purchasePrice
sellingPrice
unitPrice
lineTotal
subtotal
totalAmount
payment.amount

The API should serialize monetary values consistently for the frontend.

4.4 Physical quantities

Physical tile quantities are whole pieces.

Therefore:

physicalPieces = integer >= 0

Fractional physical pieces are never allowed.

4.5 Area quantities

Square-foot quantities may be decimal values and should use a precision-safe representation such as MongoDB Decimal128.

5. Users Collection

Collection:

users

V1 has one active business owner account. The schema should still contain a role so authorization is explicit and future expansion remains possible.

Fields

User
├── _id: ObjectId
├── name: string
├── email: string
├── passwordHash: string
├── role: OWNER
├── isActive: boolean
├── createdAt: Date
└── updatedAt: Date

Rules

email is required and normalized consistently, normally lowercase.

email must be unique.

passwordHash is required.

Plain-text passwords must NEVER be stored.

passwordHash must NEVER be returned by API responses.

Inactive users must not authenticate.

V1 role is OWNER.

6. Products Collection

Collection:

products

Products represent tile master information. Current stock does not live in this collection.

Fields

Product
├── _id: ObjectId
├── brand: string
├── productName: string
├── gallaNumber: string
├── category: string
├── size: string
├── finish: string
├── color: string
├── piecesPerBox: integer
├── areaPerBox: Decimal128
├── purchasePrice: Decimal128
├── sellingPrice: Decimal128
├── minimumStockPieces: integer
├── images: ImageReference[]
├── isActive: boolean
├── createdAt: Date
└── updatedAt: Date

Validation

piecesPerBox > 0
areaPerBox > 0
purchasePrice >= 0
sellingPrice >= 0
minimumStockPieces >= 0

Product deactivation

Products must never be hard-deleted once created.

Deactivation must operate as a soft deactivation:

isActive = false

Physical deletion of products that have historical references (inventory, transactions, or orders) is strictly forbidden to preserve business history. API endpoints for deletion (e.g. DELETE /products/:id) must strictly perform soft deactivation (setting isActive = false).

Historical orders and transactions must continue to work after product deactivation.

7. Product Measurement Model

The product stores:

piecesPerBox
areaPerBox

Example:

piecesPerBox = 4
areaPerBox = 8 sq.ft

Therefore:

1 BOX = 4 PIECES
1 BOX = 8 SQ_FT
1 PIECE = 2 SQ_FT

Formula:

areaPerPiece = areaPerBox / piecesPerBox

areaPerPiece should normally be derived rather than stored as an independently editable value.

8. Product Images

Images are references, not large binary blobs stored directly in the product document.

Conceptually:

images: [
  {
    url: string,
    publicId?: string,
    alt?: string
  }
]

The final external image provider is a separate implementation decision.

Do not store provider credentials in MongoDB documents.

9. Inventory Collection

Collection:

inventories

There is exactly one current inventory document per product in V1.

Fields

Inventory
├── _id: ObjectId
├── productId: ObjectId
├── totalPieces: integer
├── createdAt: Date
└── updatedAt: Date

A unique index must exist on:

productId

Source of truth

The canonical current physical quantity is:

totalPieces

Do NOT independently persist editable values for:

fullBoxes
loosePieces
totalSqFt

Those values are derived from the product measurement data and totalPieces.

10. Inventory Derived Values

Given:

T = totalPieces
P = piecesPerBox
A = areaPerBox

Calculate:

fullBoxes = floor(T / P)

loosePieces = T % P

areaPerPiece = A / P

totalSqFt = T × areaPerPiece

Example:

piecesPerBox = 4
areaPerBox = 8 sq.ft
totalPieces = 37

Result:

fullBoxes = 9
loosePieces = 1
totalSqFt = 74 sq.ft

These derived values are presentation/calculation values, not independent inventory sources of truth.

11. Stock Receiving

Stock arrives in complete boxes.

The stock-in UI accepts:

quantity = boxes
unit = BOX

Example:

20 BOX

If:

piecesPerBox = 4

then:

physicalPieces = 20 × 4 = 80

The backend increments:

totalPieces += 80

The backend creates an inventory transaction recording the stock-in event.

The normal stock-in operation must not require the owner to manually enter equivalent pieces or square feet.

12. Selling Units

The only supported V1 sales units are:

BOX
PIECE
SQ_FT

The API should use controlled enum values rather than arbitrary strings.

13. Locked Rule — BOX Sale

A BOX sale consumes complete boxes only.

Example:

Inventory:
10 complete boxes

Customer buys:
3 BOX

Consumption:

3 × piecesPerBox

If:

piecesPerBox = 4

then:

physicalPieces = 12

The sale must have enough complete boxes available.

Important

A BOX sale must not silently consume a combination of loose pieces and a partial box.

If only:

2 complete boxes + 3 loose pieces

are available, a sale of:

3 BOX

must be rejected.

14. Locked Rule — PIECE and SQ_FT Sale

For PIECE and SQ_FT sales, the inventory consumption strategy is:

1. Consume existing loose pieces first.
2. If more pieces are required, open complete boxes as needed.
3. Consume whole physical pieces only.

Example:

9 full boxes + 1 loose piece
piecesPerBox = 4

Customer buys:

3 PIECE

After sale:

8 full boxes + 2 loose pieces

The canonical stock changes by:

totalPieces -= 3

The physical arrangement is derived from the new total piece count.

15. Selling by Piece

For:

salesUnit = PIECE

rules are:

salesQuantity > 0
salesQuantity must be an integer
physicalPieces = salesQuantity

No fractional physical pieces are allowed.

16. Selling by Square Feet

For:

salesUnit = SQ_FT

backend calculation:

areaPerPiece = areaPerBox / piecesPerBox
physicalPieces = requestedSqFt / areaPerPiece

The result must represent a whole number of physical pieces.

Example:

piecesPerBox = 4
areaPerBox = 8
areaPerPiece = 2

requested = 6 sq.ft

6 / 2 = 3 pieces

Therefore:

physicalPieces = 3

17. Square-Foot Validation

Because tiles cannot be cut, a square-foot sale is valid only when the requested area corresponds to a whole number of pieces.

Example:

1 piece = 2 sq.ft

Valid:

2 sq.ft
4 sq.ft
6 sq.ft
8 sq.ft

Invalid:

1 sq.ft
3 sq.ft
5 sq.ft

The backend must perform this validation. Frontend validation is only a user-experience improvement.

Precision

Because area may be decimal, the implementation must use a precision-safe decimal representation and a documented comparison/tolerance strategy. It must never use unsafe binary floating-point equality for financial/measurement validation.

18. Order Item Quantity Snapshot

Every order item must preserve both the customer's sales unit and the physical inventory consumption.

Conceptually:

OrderItem
├── productId: ObjectId
├── productNameSnapshot: string
├── brandSnapshot: string
├── salesQuantity: Decimal128/integer according to unit
├── salesUnit: BOX | PIECE | SQ_FT
├── physicalPieces: integer
├── unitPrice: Decimal128
├── lineTotal: Decimal128
└── optional measurement snapshots

Examples:

Box

salesQuantity = 3
salesUnit = BOX
physicalPieces = 12

Piece

salesQuantity = 3
salesUnit = PIECE
physicalPieces = 3

Square feet

salesQuantity = 6
salesUnit = SQ_FT
physicalPieces = 3

19. Orders Collection

Collection:

orders

Order items are embedded inside the order document in V1.

This is intentional because an order is a bounded business document and its items belong to the order's historical record.

Fields

Order
├── _id: ObjectId
├── orderNumber: string (Format: GT-YYYYMMDD-XXXX, unique, generated via atomic counter)
├── customerId: ObjectId
├── items: OrderItem[]
├── subtotal: Decimal128
├── totalAmount: Decimal128
├── status: COMPLETED | CANCELLED
├── createdAt: Date
├── updatedAt: Date
└── createdBy: ObjectId

In V1, the order status enum contains strictly two values:
- COMPLETED
- CANCELLED

Order numbers follow the format: GT-YYYYMMDD-XXXX. They must be generated atomically using a MongoDB counter document (via findOneAndUpdate) to eliminate any possibility of duplicate order numbers under concurrency.

20. Order Product Snapshot

Historical order data must not depend on the current product document.

At order creation/completion, snapshot the product information required to display and understand the historical transaction.

At minimum:

productId
productNameSnapshot
brandSnapshot
unitPrice
salesQuantity
salesUnit
physicalPieces
lineTotal

If product measurement information is needed to explain historical quantity, the relevant measurement values should also be snapshotted.

Changing the current product name, measurement or selling price must not rewrite an existing order.

21. Order Amount and Pricing

V1 does not implement customer-specific pricing tiers.

There are no:

customer-specific price lists
wholesale tiers
retail tiers
customer pricing rules

The order stores the actual transaction amount applicable to that sale.

Product-level purchasePrice and sellingPrice are business reference values only; the historical order uses its own price snapshot.

Backend calculations must validate the order totals before persistence.

22. Customers Collection

Collection:

customers

Fields

Customer
├── _id: ObjectId
├── name: string
├── phone: string
├── address: string
├── isActive: boolean
├── createdAt: Date
└── updatedAt: Date

Customer outstanding must NOT be treated as a manually editable source-of-truth field.

Orders and payments are authoritative.

23. Customer Relationships

One customer can have many orders:

Customer
   ├── Order 1
   ├── Order 2
   └── Order 3

The customer document stores customer information, not duplicated full order documents.

Orders reference:

customerId

24. Payments Collection

Collection:

payments

Each payment is an individual financial transaction.

Fields

Payment
├── _id: ObjectId
├── customerId: ObjectId
├── orderId: ObjectId
├── amount: Decimal128
├── paymentMethod: CASH | UPI | BANK_TRANSFER | CHEQUE
├── paymentDate: Date
├── notes?: string
├── createdAt: Date
└── createdBy: ObjectId

orderId is required in V1.

There are no unallocated customer payments in V1.

25. Locked Rule — Payments

Every payment must belong to an existing order.

The system does NOT support:

unallocated payment
advance payment without an order
customer wallet balance

Example:

Order = ₹45,000
Payment = ₹20,000

The payment references that order.

Another payment can later reference the same order:

Payment 1 = ₹20,000
Payment 2 = ₹10,000
Payment 3 = ₹15,000

26. Payment Validation

The backend must reject:

amount <= 0
payment for a non-existent order
payment for a non-existent customer
payment whose customerId does not match the order customer
payment that would make total valid payments exceed order total

Unless a future approved business rule explicitly introduces overpayments, overpayment must not be accepted in V1.

27. Payment Methods

V1 supported methods:

CASH
UPI
BANK_TRANSFER
CHEQUE

The backend must use controlled enum values.

28. Outstanding Amount

Order outstanding is derived:

outstanding = totalAmount - validPaymentsTotal

Example:

Order Amount = ₹45,000
Paid = ₹20,000
Outstanding = ₹25,000

The system should not rely on a manually editable outstandingAmount field as the source of truth.

If a cached/derived value is introduced for performance later, it must be treated as derived state and kept transactionally consistent.

29. Customer Outstanding

Customer outstanding is derived from the customer's valid orders and payments.

Conceptually:

Customer Outstanding
=
Sum(valid order amounts)
-
Sum(valid payments)

Only orders that represent valid business sales should contribute according to the final order-status rules.

Cancelled orders and reversed financial records must not incorrectly increase outstanding.

30. Payment History

Payments represent financial history and must not be casually hard-deleted.

If a future correction/reversal workflow is required, it should preserve the original financial event and record the corrective event rather than silently destroying history.

31. Inventory Transactions Collection

Collection:

inventory_transactions

This collection records every important physical inventory movement.

Fields

InventoryTransaction
├── _id: ObjectId
├── productId: ObjectId
├── transactionType: enum
├── physicalPieces: integer
├── salesQuantity?: Decimal128/integer
├── salesUnit?: BOX | PIECE | SQ_FT
├── orderId?: ObjectId
├── reason?: string
├── createdAt: Date
└── createdBy: ObjectId

For a transaction that changes stock, physicalPieces represents the signed movement:

positive = stock added
negative = stock removed

32. Inventory Transaction Types

V1 types:

STOCK_IN
SALE
DAMAGE
ADJUSTMENT
SALE_REVERSAL

SALE_REVERSAL is required for cancelled orders so inventory restoration is auditable.

33. Stock-In Transaction Example

transactionType = STOCK_IN
salesQuantity = 20
salesUnit = BOX
physicalPieces = +80

where:

piecesPerBox = 4

34. Sale Transaction Example

For a 3-piece sale:

transactionType = SALE
salesQuantity = 3
salesUnit = PIECE
physicalPieces = -3
orderId = <order id>

For a 6 sq.ft sale where one piece equals 2 sq.ft:

transactionType = SALE
salesQuantity = 6
salesUnit = SQ_FT
physicalPieces = -3
orderId = <order id>

35. Damage Transaction

Example:

transactionType = DAMAGE
physicalPieces = -2
reason = "Broken tiles"

If a complete box is damaged:

physicalPieces = -piecesPerBox

The inventory history must preserve the reason and creator.

36. Manual Adjustment

Manual physical stock corrections must create an inventory transaction.

Examples:

+3 pieces
-2 pieces

with a reason such as:

Physical stock count correction
Found stock
Missing stock
Data entry correction

The old inventory history must not be overwritten.

37. Locked Rule — Order Cancellation and Stock Restoration

When an order that consumed inventory is cancelled, the inventory consumed by that order must be restored automatically.

Example:

Original sale:
physicalPieces = -6

Cancellation creates:

SALE_REVERSAL
physicalPieces = +6

The cancellation must be idempotent: cancelling the same order multiple times must not restore stock multiple times.

A cancelled order must not continue contributing to active sales/outstanding calculations according to the final order-status rules.

38. Inventory Availability

Before completing a sale, the backend must validate stock availability.

The frontend stock display is NOT authoritative.

Examples:

Available = 3 pieces
Requested = 4 pieces

The backend rejects the operation.

The same validation applies after converting:

BOX → pieces
PIECE → pieces
SQ_FT → pieces

For BOX sales, complete-box availability must additionally be checked.

39. Inventory and Order Atomicity

A sale can involve several related operations:

Validate order
Validate stock
Create order
Reduce inventory
Create SALE inventory transaction

These operations must be performed with an appropriate MongoDB transaction/consistency strategy so the system does not leave partial state.

The intended business behavior is:

All required operations succeed
        ↓
COMMIT

or:

Any required operation fails
        ↓
ROLLBACK

The implementation must account for MongoDB transaction deployment requirements.

40. Cancellation Atomicity

Order cancellation and inventory restoration should also be consistent.

Conceptually:

BEGIN

1. Verify order exists.
2. Verify order is cancellable.
3. Verify it has not already been reversed.
4. Restore consumed physical pieces.
5. Create SALE_REVERSAL transaction.
6. Update order status.

COMMIT

If any required operation fails, the transaction must not leave half-cancelled state.

41. Inventory Calculation Example

Starting:

10 boxes
4 pieces per box

Canonical inventory:

totalPieces = 40

Sale:

3 pieces

New canonical inventory:

totalPieces = 37

Derived:

fullBoxes = floor(37 / 4) = 9
loosePieces = 37 % 4 = 1

Sale of another 2 pieces:

totalPieces = 35
fullBoxes = 8
loosePieces = 3

42. Product Measurement Changes

Product measurements such as:

piecesPerBox
areaPerBox

are critical to inventory calculations.

They must not be changed casually after stock and historical orders exist.

If such a change is ever required, the agent must first identify:

affected inventory calculations

affected active stock

affected historical orders

affected inventory transactions

migration requirements

An architectural/destructive change requires explicit approval and a documented decision.

Historical order snapshots must remain unchanged.

43. Order Status and Financial/Inventory Semantics

The order status enum is locked and consistent across:

BUSINESS-RULES.md
API.md
DATABASE.md

In V1, the only permitted order statuses are:

1. COMPLETED: represents a valid completed sale where physical inventory has been deducted.
2. CANCELLED: represents a cancelled sale where physical inventory has been restored via SALE_REVERSAL.

There is NO DRAFT state in V1. An order is persisted upon completion of the transaction.

44. Reports and Dashboard

Reports should be derived from authoritative business records.

Initial reporting periods:

Today
This Week
This Month
Custom Date Range

Initial report areas:

Sales
Orders
Top-selling Products
Inventory Movement
Customers
Outstanding Payments

Dashboard values such as:

Today's Sales
Today's Orders
Total Customers
Total Products
Low Stock Products
Outstanding Amount

must not depend on manually entered totals.

45. Low Stock

The product stores:

minimumStockPieces

The inventory source of truth is:

totalPieces

A product is low stock when:

totalPieces <= minimumStockPieces

The UI may display the equivalent:

full boxes
loose pieces
square feet

but the threshold comparison uses whole pieces.

46. Recommended Indexes

Indexes must reflect actual query patterns.

users

email: UNIQUE

products

Recommended:

brand
productName
category
isActive
gallaNumber

Do not create every possible index automatically. Indexes should be justified by query patterns.

inventories

productId: UNIQUE

customers

Recommended:

phone
name
isActive

Phone uniqueness should only be enforced if the business explicitly requires one customer per phone number.

orders

Recommended compound/query indexes:

customerId + createdAt
status + createdAt
orderNumber: UNIQUE

payments

Recommended:

orderId + paymentDate
customerId + paymentDate

inventory_transactions

Recommended:

productId + createdAt
orderId
transactionType + createdAt

Final indexes should be reviewed against real API queries before production.

47. Referential Integrity

MongoDB does not provide relational foreign-key enforcement in the same way as a SQL database.

Therefore the NestJS backend must validate referenced IDs.

Examples:

order.customerId → existing customer
order.items[].productId → existing product
payment.orderId → existing order
payment.customerId → same customer as order
inventory.productId → existing product
inventory_transaction.productId → existing product

Business operations that create multiple references must validate them before commit.

48. Deletion Policy

The following are business history and must not be casually hard-deleted:

orders
payments
inventory_transactions

Products should normally be deactivated:

isActive = false

Customers should normally be deactivated if historical relationships exist.

Hard deletion of historical data requires an explicit business and architectural decision.

49. Security Requirements

Database access must be server-side only.

Never expose to the browser:

MongoDB URI
MongoDB username
MongoDB password
Database credentials

Production access must follow least privilege.

MongoDB Atlas network access, database users, credentials, backups and monitoring must be configured as production infrastructure rather than committed to source control.

Secrets must live in environment/secret-management infrastructure, not in Git.

50. Backend Authority

The backend is the final authority for:

Authentication
Authorization
Product validation
Inventory availability
Unit conversion
Square-foot validation
Order totals
Payment validation
Outstanding calculations
Cancellation
Inventory restoration

The frontend may perform early validation for usability, but backend validation is mandatory.

51. Transactional Business Examples

Example A — Complete Box Sale

Product:
4 pieces/box

Inventory:
10 complete boxes
= 40 pieces

Sale:
3 boxes

Physical consumption:
12 pieces

Remaining:
28 pieces
= 7 complete boxes

Example B — Piece Sale

Inventory:
9 boxes + 1 loose
= 37 pieces

Sale:
3 pieces

Remaining:
34 pieces
= 8 boxes + 2 loose

Example C — Square-Foot Sale

4 pieces/box
8 sq.ft/box

1 piece = 2 sq.ft

Sale:
6 sq.ft

Physical consumption:
3 pieces

Example D — Partial Payment

Order:
₹45,000

Payment 1:
₹20,000

Outstanding:
₹25,000

Example E — Cancellation

Sale:
-6 pieces

Cancellation:
+6 pieces via SALE_REVERSAL

52. Data Integrity Rules

The system must reject invalid states including:

negative inventory
fractional physical pieces
zero/negative piecesPerBox
zero/negative areaPerBox
negative money
zero/negative payment
payment greater than remaining order balance
invalid square-foot conversion
sale above available stock
BOX sale without enough complete boxes
payment linked to another customer's order
repeated cancellation/reversal
unauthorized database mutation

Business validation belongs in backend domain/application logic and appropriate schema validation.

53. Source of Truth Matrix

Data

Source of truth

User authentication

users

Product definition

products

Current physical stock

inventories.totalPieces

Inventory history

inventory_transactions

Customer information

customers

Historical sales

orders

Payment history

payments

Order outstanding

Derived from order + valid payments

Customer outstanding

Derived from valid orders + payments

Full boxes

Derived from inventory + product measurement

Loose pieces

Derived from inventory + product measurement

Total sq.ft

Derived from inventory + product measurement

Sales reports

Derived from authoritative order data

54. Schema Evolution

Database schema changes must be controlled.

The AI agent must NOT silently change the production data model.

For any architectural or destructive schema change, the agent must:

Explain the proposed change.

Explain why it is needed.

Identify affected collections.

Identify affected modules/API contracts.

Identify migration/data risks.

Identify historical-data implications.

Identify security implications.

Update DECISIONS.md when the architecture changes.

Wait for explicit approval before destructive or architectural changes.

55. Implementation Boundary

This document defines the database/domain contract. It does not itself define every Mongoose decorator or implementation detail.

The implementation must create corresponding Mongoose schemas/models that respect this document.

The next implementation stage should produce:

UserSchema
ProductSchema
InventorySchema
CustomerSchema
OrderSchema
PaymentSchema
InventoryTransactionSchema

along with DTO validation, service-level business rules, indexes, and transaction handling.

The implementation must not introduce a conflicting schema simply because it is easier to code.

56. Final V1 Database Architecture

                           MongoDB Atlas
                                │
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
      users                  products                customers
        │                       │                        │
        │                       │                        │
        │                 inventories                   │
        │                       │                        │
        │                       ▼                        │
        │            inventory_transactions             │
        │                       ▲                        │
        │                       │                        │
        │                    orders ◄───────────────────┘
        │                       │
        │                       ▼
        │                    payments
        │
        └── authentication

Core invariant

Current physical inventory
        =
Inventory.totalPieces

and:

Order
  → historical sale

Payment
  → financial transaction

Inventory Transaction
  → physical stock movement

These boundaries must remain clear throughout implementation.