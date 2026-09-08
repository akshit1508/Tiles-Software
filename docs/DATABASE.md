# Tile Management System — Database Design

## 1. Database Overview

Database technology:

```text
MongoDB
```

Production database:

```text
MongoDB Atlas
```

The database stores the persistent business data for:

* Users
* Products
* Customers
* Orders
* Payments
* Inventory
* Inventory history

The database is the persistent source of truth for the business application.

---

# 2. Application Architecture

The application consists of:

```text
Browser
   ↓
Next.js Frontend
   ↓
NestJS Backend API
   ↓
MongoDB
```

The frontend must NEVER connect directly to MongoDB.

All database operations must happen through the NestJS backend.

MongoDB credentials and connection strings must remain server-side.

---

# 3. Main Collections

The initial database domain will contain collections similar to:

```text
users
products
customers
orders
payments
inventory_transactions
```

Additional collections may be introduced later only when there is a clear business or architectural requirement.

The AI agent must not create unnecessary collections without justification.

---

# 4. User Collection

The `users` collection represents authenticated application users.

V1 has only one user: the business owner.

Expected information:

```text
User
├── id
├── name
├── email
├── passwordHash
├── role
├── createdAt
└── updatedAt
```

The password itself must NEVER be stored.

Only a secure password hash may be stored.

The password hash must never be returned through an API response.

---

# 5. Product Collection

The `products` collection represents tile products.

Expected information:

```text
Product
├── id
├── brand
├── productName
├── gallaNumber
├── category
├── size
├── finish
├── color
├── piecesPerBox
├── areaPerBox
├── purchasePrice
├── sellingPrice
├── minimumStock
├── images
├── createdAt
└── updatedAt
```

---

# 6. Product Fields

## Brand

The tile brand.

Example:

```text
Kajaria
```

---

## Product Name

The name/identifier of the tile product.

Example:

```text
Royal Marble
```

---

## Galla Number

The physical storage/location identifier used by the shop.

Example:

```text
G-24
```

---

## Category

The product category.

Example:

```text
Floor Tile
Wall Tile
```

The final category structure will be decided during implementation.

---

## Size

The physical tile size.

Example:

```text
4x2
```

The exact storage representation will be finalized during implementation.

---

## Finish

Example:

```text
Glossy
Matt
```

---

## Color

Example:

```text
White
Grey
Beige
```

---

## Pieces Per Box

Defines how many complete tiles are contained in one complete box.

Example:

```text
piecesPerBox = 4
```

This value must be greater than zero.

---

## Area Per Box

Defines the total square-foot coverage represented by one complete box.

Example:

```text
areaPerBox = 8 sq.ft
```

This value must be greater than zero.

---

# 7. Product Measurement Relationship

The system uses:

```text
piecesPerBox
areaPerBox
```

to determine the relationship between boxes, pieces and square feet.

Example:

```text
piecesPerBox = 4
areaPerBox = 8 sq.ft
```

Therefore:

```text
1 Box = 4 Pieces
1 Box = 8 sq.ft
1 Piece = 2 sq.ft
```

The system should calculate the area per piece rather than requiring the owner to enter it separately.

Formula:

```text
areaPerPiece =
areaPerBox / piecesPerBox
```

---

# 8. Product Price Fields

The product may contain:

```text
purchasePrice
sellingPrice
```

These represent product-level business pricing information.

V1 does not implement customer-specific pricing.

There are no:

```text
Customer Price Lists
Wholesale Price Tiers
Retail Price Tiers
Customer-specific Price Rules
```

The actual transaction/order amount is recorded with the order.

Historical orders must retain the amount applicable when that order was created.

Changing the current product price must not change historical order amounts.

---

# 9. Product Images

A product may have multiple images.

The database should store image references/URLs rather than unnecessarily storing large binary image data directly inside the product document.

Conceptually:

```text
images:
[
    {
        url: "...",
        ...
    }
]
```

The exact image-storage provider will be decided during implementation.

---

# 10. Inventory Design

Inventory is separate from basic product information.

The system must accurately track physical tile inventory.

The inventory must support:

```text
Boxes
Pieces
Square Feet
```

However, these quantities should not be treated as three independently editable values.

The system needs a canonical physical inventory representation to prevent inconsistent values.

---

# 11. Canonical Inventory Quantity

Because tiles are physical whole pieces, the recommended canonical inventory quantity is:

```text
Total Available Whole Pieces
```

For example:

```text
totalPieces = 37
```

The system can derive:

```text
Complete Boxes
Loose Pieces
Total Square Feet
```

using the product's:

```text
piecesPerBox
areaPerBox
```

---

# 12. Inventory Conversion

Given:

```text
totalPieces = T
piecesPerBox = P
areaPerBox = A
```

The system calculates:

```text
Complete Boxes =
floor(T / P)

Loose Pieces =
T % P

Area Per Piece =
A / P

Total Square Feet =
T × Area Per Piece
```

Example:

```text
piecesPerBox = 4
areaPerBox = 8
totalPieces = 37
```

Result:

```text
Complete Boxes = 9
Loose Pieces = 1
Total Pieces = 37
Total Area = 74 sq.ft
```

---

# 13. Stock Receiving

Stock always arrives at the shop in complete boxes.

Therefore stock receiving is entered in:

```text
Boxes
```

Example:

```text
Stock received = 20 boxes
```

If:

```text
1 box = 4 pieces
```

then:

```text
20 boxes = 80 pieces
```

If:

```text
1 box = 8 sq.ft
```

then:

```text
20 boxes = 160 sq.ft
```

The owner should not need to manually enter equivalent pieces or square feet for normal stock receiving.

The backend calculates the physical equivalent.

---

# 14. Inventory Transactions Collection

The `inventory_transactions` collection records important inventory changes.

Conceptually:

```text
InventoryTransaction
├── id
├── productId
├── transactionType
├── quantity
├── unit
├── physicalQuantity
├── physicalUnit
├── reason
├── orderId
├── createdAt
└── createdBy
```

Not every field is required for every transaction.

For example:

```text
orderId
```

is relevant for a sale but may not be relevant for a damage transaction.

---

# 15. Inventory Transaction Types

Initial transaction types:

```text
STOCK_IN
SALE
DAMAGE
ADJUSTMENT
```

Additional transaction types can be added later if required.

---

# 16. Stock-In Transaction

Stock-in represents new tile stock arriving at the shop.

Because stock always arrives as complete boxes, the transaction records the received box quantity.

Example:

```text
quantity = 20
unit = BOX
```

The backend converts this into the equivalent whole-piece quantity.

Example:

```text
20 boxes × 4 pieces per box
=
80 pieces
```

The inventory transaction should preserve enough information to understand the original stock-in event.

---

# 17. Selling Units

The system allows products to be sold by:

```text
BOX
PIECE
SQ_FT
```

These are valid sales units.

However, physical inventory must always represent whole physical tiles.

---

# 18. Selling by Box

Example:

```text
1 box = 4 pieces
1 box = 8 sq.ft
```

Customer buys:

```text
3 boxes
```

Physical inventory consumption:

```text
3 boxes × 4 pieces
=
12 pieces
```

The order item can preserve:

```text
salesQuantity = 3
salesUnit = BOX

physicalQuantity = 12
physicalUnit = PIECE
```

---

# 19. Selling by Piece

The owner can sell individual whole tiles.

Example:

```text
Customer buys 3 pieces
```

Inventory decreases by:

```text
3 whole pieces
```

No fractional physical pieces are allowed.

---

# 20. Selling by Square Feet

The owner can enter a square-foot quantity when preparing an order.

The backend converts the requested square-foot quantity into whole pieces.

Example:

```text
piecesPerBox = 4
areaPerBox = 8 sq.ft

areaPerPiece =
8 / 4
=
2 sq.ft
```

If the owner enters:

```text
6 sq.ft
```

the system calculates:

```text
6 / 2
=
3 pieces
```

Therefore inventory decreases by:

```text
3 whole pieces
```

The order item should preserve both:

```text
salesQuantity = 6
salesUnit = SQ_FT

physicalQuantity = 3
physicalUnit = PIECE
```

---

# 21. Square-Foot Validation

Because tiles cannot be cut, a square-foot sale must correspond to a whole number of physical pieces.

Example:

```text
1 piece = 2 sq.ft
```

Valid:

```text
2 sq.ft = 1 piece
4 sq.ft = 2 pieces
6 sq.ft = 3 pieces
8 sq.ft = 4 pieces
```

Invalid:

```text
1 sq.ft
3 sq.ft
5 sq.ft
```

because these would require fractional physical pieces.

The backend must reject an invalid square-foot quantity.

The frontend may also validate this for better user experience, but backend validation is mandatory.

---

# 22. Partial / Open Boxes

The inventory must support opened boxes.

Example:

```text
1 box = 4 pieces

Starting inventory:

10 boxes
=
40 pieces
```

Customer purchases:

```text
3 pieces
```

Remaining physical inventory:

```text
9 complete boxes
1 loose piece
```

The system must preserve the loose piece.

It must not incorrectly reduce the stock from:

```text
10 boxes
```

to:

```text
9 boxes
```

without accounting for the remaining loose piece.

---

# 23. Damaged Stock

Damaged or broken tiles must be recorded as inventory transactions.

Example:

```text
2 damaged pieces
```

The canonical physical inventory decreases by:

```text
2 pieces
```

The transaction should preserve:

```text
transactionType = DAMAGE
quantity = 2
unit = PIECE
reason = ...
```

If a complete box is damaged:

```text
1 box
```

the system converts the box to the appropriate number of physical pieces.

---

# 24. Manual Inventory Adjustment

The owner may need to adjust inventory because of:

* Physical stock count differences
* Data-entry mistakes
* Missing tiles
* Found stock
* Other legitimate business reasons

Adjustments must create inventory history.

Example:

```text
Adjustment:
-3 pieces

Reason:
Physical stock count difference
```

The previous history must not be silently overwritten.

---

# 25. Inventory History

Every important inventory movement should create a history record.

Examples:

```text
STOCK_IN
SALE
DAMAGE
ADJUSTMENT
```

Inventory history should make it possible to answer:

```text
When did stock change?
Why did it change?
Which product changed?
How much changed?
Was it connected to an order?
Who performed the operation?
```

---

# 26. Inventory Availability

Before an order is completed, the backend must verify that sufficient inventory exists.

The frontend's displayed stock is not authoritative.

Example:

Available:

```text
3 pieces
```

Attempted sale:

```text
4 pieces
```

The backend must reject the sale.

The same rule applies to sales entered as:

```text
BOX
PIECE
SQ_FT
```

The backend converts the requested quantity into physical pieces and validates availability.

---

# 27. Customer Collection

The `customers` collection represents business customers.

Expected information:

```text
Customer
├── id
├── name
├── phone
├── address
├── createdAt
└── updatedAt
```

---

# 28. Customer Relationships

A customer can have multiple orders.

Conceptually:

```text
Customer
   │
   ├── Order 1
   ├── Order 2
   └── Order 3
```

Orders reference the customer.

The customer document should not contain duplicated complete order documents unless there is a specific architectural reason.

---

# 29. Customer Payments

A customer can have multiple payments.

Payments should reference:

```text
customerId
```

and, when applicable:

```text
orderId
```

This allows the system to provide:

* Customer payment history
* Order payment history
* Customer outstanding amount

---

# 30. Order Collection

The `orders` collection represents a customer transaction.

Conceptually:

```text
Order
├── id
├── customerId
├── items
├── totalAmount
├── status
├── createdAt
└── updatedAt
```

Additional fields may be added when required.

---

# 31. Order Items

One order can contain multiple products.

Conceptually:

```text
Order
│
├── OrderItem
│     ├── productId
│     ├── salesQuantity
│     ├── salesUnit
│     ├── physicalQuantity
│     └── physicalUnit
│
├── OrderItem
│     ├── productId
│     ├── salesQuantity
│     ├── salesUnit
│     ├── physicalQuantity
│     └── physicalUnit
│
└── ...
```

Because MongoDB supports embedded documents, order items can be embedded inside the order document when appropriate.

The final implementation should prioritize historical correctness and efficient order retrieval.

---

# 32. Order Quantity Example — Box

Example:

```text
Product:
Royal Marble

Pieces Per Box:
4

Sales:
2 Boxes
```

Order item may contain:

```text
salesQuantity = 2
salesUnit = BOX

physicalQuantity = 8
physicalUnit = PIECE
```

---

# 33. Order Quantity Example — Piece

Example:

```text
Sales:
3 Pieces
```

Order item:

```text
salesQuantity = 3
salesUnit = PIECE

physicalQuantity = 3
physicalUnit = PIECE
```

---

# 34. Order Quantity Example — Square Feet

Example:

```text
Area Per Piece = 2 sq.ft

Customer purchases:
6 sq.ft
```

Order item:

```text
salesQuantity = 6
salesUnit = SQ_FT

physicalQuantity = 3
physicalUnit = PIECE
```

This allows the application to preserve what was entered as the sales quantity while maintaining accurate physical inventory.

---

# 35. Historical Product Information

Orders must preserve the relevant product information required for historical accuracy.

The system must not rely entirely on the current product document to reconstruct an old order.

For example:

```text
Product selling price today = ₹1,200
```

does not mean an order created earlier should automatically change to:

```text
₹1,200
```

Historical order information must remain unchanged.

The exact snapshot fields will be finalized during implementation.

---

# 36. Order Amount

The actual transaction/order amount is associated with the order.

V1 does not implement customer-specific pricing.

The owner records the applicable amount when preparing the transaction.

Important financial calculations must be validated on the backend.

---

# 37. Payment Collection

The `payments` collection represents individual payment transactions.

Expected information:

```text
Payment
├── id
├── customerId
├── orderId
├── amount
├── paymentMethod
├── paymentDate
├── notes
├── createdAt
└── createdBy
```

---

# 38. Payment Methods

Initial supported payment methods:

```text
CASH
UPI
BANK_TRANSFER
CHEQUE
```

The system should use controlled values rather than arbitrary inconsistent strings.

---

# 39. Multiple Payments

A single order can have multiple payments.

Example:

```text
Order Amount:
₹50,000

Payment 1:
₹20,000
UPI

Payment 2:
₹10,000
Cash

Payment 3:
₹20,000
Bank Transfer
```

Total paid:

```text
₹50,000
```

Outstanding:

```text
₹0
```

---

# 40. Partial Payment

Example:

```text
Order Amount:
₹50,000

Payment:
₹20,000
```

Outstanding:

```text
₹30,000
```

The payment is stored as its own transaction.

---

# 41. Credit / Outstanding

Orders may be:

```text
Fully Paid
Partially Paid
Unpaid / Credit
```

Outstanding amount is derived from:

```text
Order Amount
-
Valid Payments
```

Example:

```text
Order Amount = ₹50,000

Paid = ₹20,000

Outstanding = ₹30,000
```

---

# 42. Customer Outstanding

Customer-level outstanding can be calculated from the customer's orders and payments.

Conceptually:

```text
Customer Outstanding
=
Total Amount Due
-
Total Valid Payments
```

Example:

```text
Order 1 = ₹50,000
Order 2 = ₹30,000

Total Due = ₹80,000

Payments = ₹50,000

Outstanding = ₹30,000
```

The system should not rely solely on a manually edited outstanding value.

---

# 43. Payment History

Each payment should remain an individual financial transaction.

Payment history should preserve:

* Customer
* Related order
* Amount
* Payment method
* Date
* Notes/reference
* Creator

Payments should not be casually hard-deleted.

If a correction is required, an appropriate reversal/adjustment mechanism should preserve financial history.

---

# 44. Sales Data

Sales information should primarily be derived from valid/completed orders according to the application's order-status rules.

The system should avoid unnecessarily duplicating sales totals into separate collections.

Reports should use authoritative order data.

---

# 45. Dashboard Data

Dashboard information such as:

```text
Today's Sales
Today's Orders
Total Customers
Total Products
Low Stock
Outstanding Amount
```

should be calculated from authoritative database records or carefully maintained derived values.

The dashboard must not rely on manually entered totals.

---

# 46. Low Stock

Each product contains:

```text
minimumStock
```

When available inventory reaches the defined low-stock threshold, the product should be identified as low stock.

The exact comparison logic will be finalized during implementation.

Because inventory is tracked physically in pieces and displayed in boxes/pieces/sq.ft, the implementation must define which physical quantity is used for the threshold.

---

# 47. Reports

The initial reporting system should support:

```text
Today
This Week
This Month
Custom Date Range
```

Initial reports:

```text
Sales
Orders
Top-selling Products
Inventory Movement
Customers
Outstanding Payments
```

Report calculations must be performed consistently by the backend.

---

# 48. Order and Inventory Consistency

Creating/completing a sale can involve multiple operations:

```text
Create/complete order
+
Create order items
+
Reduce inventory
+
Create inventory transaction
```

These operations must be designed so that the system does not produce inconsistent business data.

The implementation should use an appropriate MongoDB transaction/consistency strategy where supported and appropriate.

The system must avoid situations such as:

```text
Order created
but inventory not reduced
```

or:

```text
Inventory reduced
but order not successfully created
```

when the business operation is expected to be atomic.

---

# 49. Data Integrity

The system must prevent or reject invalid states such as:

```text
Negative physical inventory
Fractional physical pieces
Negative payment amounts
Invalid order quantities
Invalid product measurement values
Inconsistent financial calculations
Unauthorized modifications
```

All important business validation must happen on the backend.

---

# 50. Deletion Strategy

Historical business records should not be casually hard-deleted.

Especially:

```text
Orders
Payments
Inventory Transactions
```

represent business history.

For products, deactivation/soft deletion should be preferred when historical orders or inventory transactions reference the product.

The final deletion policy will be defined before implementation.

---

# 51. Database Indexes

Appropriate MongoDB indexes should be created based on actual query patterns.

Likely indexed fields include:

## Products

```text
brand
productName
gallaNumber
category
```

## Customers

```text
phone
name
```

## Orders

```text
customerId
createdAt
status
```

## Payments

```text
customerId
orderId
paymentDate
```

## Inventory Transactions

```text
productId
createdAt
transactionType
```

The final indexes should be determined during implementation after reviewing the application's actual queries.

---

# 52. Database Validation

Important application/database values must satisfy appropriate constraints.

Examples:

```text
piecesPerBox > 0
areaPerBox > 0
minimumStock >= 0
payment amount > 0
order quantity > 0
physical inventory quantity >= 0
```

The backend must validate external input before writing to MongoDB.

---

# 53. Security

MongoDB credentials must remain exclusively on the backend.

The frontend must never receive:

```text
MongoDB URI
Database username
Database password
Database credentials
```

Production database access must use appropriate credentials and least-privilege principles.

MongoDB Atlas network/access controls should be configured appropriately for production.

---

# 54. Source of Truth

The following collections are authoritative for their respective domains:

```text
users
    ↓
Authentication users

products
    ↓
Product definitions

inventory_transactions
    ↓
Inventory movement history

customers
    ↓
Customer information

orders
    ↓
Orders and historical transaction information

payments
    ↓
Payment history
```

Derived information such as:

```text
Current Inventory
Outstanding Amount
Sales Reports
Dashboard Statistics
```

should be calculated from authoritative records or maintained through carefully controlled derived-state mechanisms.

---

# 55. Schema Evolution

Database/model changes must be documented.

The AI agent must not make destructive schema changes without explicit approval.

Before making an architectural database change, the agent must:

1. Explain the proposed change.
2. Explain why it is needed.
3. Identify affected collections.
4. Identify affected backend modules.
5. Identify data/migration risks.
6. Explain security implications.
7. Wait for approval when the change is destructive or architectural.
