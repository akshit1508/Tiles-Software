# API Specification

All protected endpoints require authentication via secure HttpOnly cookie or Authorization header.

## Authentication

### `POST /auth/login`
- Authenticates the shop owner with email and password.
- Sets secure `HttpOnly` JWT cookie and returns owner profile.
- There is NO public signup/registration endpoint in V1. Owner provisioning is handled via `npm run seed:admin`.

### `POST /auth/logout`
- Clears the authentication cookie and invalidates session.

### `GET /auth/me`
- Returns the currently authenticated owner profile.


## Products

### `POST /products`
- Creates a new tile product master record.
- Automatically initializes an associated `inventories` document with `totalPieces = 0`.

### `GET /products`
- Returns paginated and filtered list of products (filterable by `brand`, `category`, `isActive`, `gallaNumber`, search query).

### `GET /products/:id`
- Returns a specific product by ID.

### `PATCH /products/:id`
- Updates mutable product metadata. Measurements (`piecesPerBox`, `areaPerBox`) should be protected against casual edits if inventory exists.

### `DELETE /products/:id`
- Performs **soft deactivation** (`isActive = false`).
- Does NOT hard-delete the product from MongoDB to preserve historical orders and inventory movements.


## Inventory

### `GET /inventory`
- Returns current physical stock list with derived quantities (`fullBoxes`, `loosePieces`, `totalSqFt`) and low-stock flags (`totalPieces <= minimumStockPieces`).

### `GET /inventory/:productId`
- Returns inventory details and derived unit values for a single product.

### `POST /inventory/stock-in`
- Accepts complete boxes (`quantity`, `unit = BOX`).
- Increments `totalPieces += quantity * piecesPerBox` and logs a `STOCK_IN` inventory transaction.

### `POST /inventory/adjustment`
- Adjusts physical pieces with a mandatory reason.
- Records an `ADJUSTMENT` inventory transaction (signed pieces).

### `POST /inventory/damage`
- Records damaged physical pieces or boxes with a mandatory reason.
- Decrements stock and records a `DAMAGE` inventory transaction.

### `GET /inventory/:productId/history`
- Returns paginated history of inventory transactions (`STOCK_IN`, `SALE`, `DAMAGE`, `ADJUSTMENT`, `SALE_REVERSAL`) for the product.


## Customers

### `POST /customers`
- Creates a new customer (`name`, `phone`, `address`).

### `GET /customers`
- Returns customer list with derived totals (total orders, derived outstanding balance).

### `GET /customers/:id`
- Returns customer details, order history, and payment ledger.

### `PATCH /customers/:id`
- Updates customer profile or deactivates (`isActive = false`).


## Orders

### `POST /orders`
- Creates an order in `COMPLETED` status.
- Atomically:
  1. Validates stock availability (including complete box availability for `BOX` sales and whole piece validity for `SQ_FT` sales).
  2. Generates unique order number in format `GT-YYYYMMDD-XXXX` using an atomic MongoDB counter.
  3. Snapshots product names, brands, units, quantities, physical pieces, prices, and line totals.
  4. Deducts physical pieces from `inventories`.
  5. Records `SALE` transactions in `inventory_transactions`.
- There is NO `DRAFT` status in V1.

### `GET /orders`
- Returns list of orders with filters (status: `COMPLETED` | `CANCELLED`, `customerId`, date range, search).
- Includes derived payment summary (`paidAmount`, `outstandingAmount`).

### `GET /orders/:id`
- Returns full order details with snapshotted line items and recorded payment history.

### `POST /orders/:id/cancel`
- Dedicated business command for order cancellation. Generic order patching via `PATCH /orders/:id` is NOT supported.
- Cancellation flow (executed atomically):
  1. Verifies the order exists and is currently in `COMPLETED` status.
  2. Restores the exact `physicalPieces` consumed by each line item back to `inventories`.
  3. Records a `SALE_REVERSAL` inventory transaction for each line item.
  4. Updates the order status to `CANCELLED`.
  5. Commits the transaction atomically.
- Strictly idempotent: a second cancellation attempt on an already `CANCELLED` order is rejected and will not restore inventory again.


## Payments

### `POST /payments`
- Records a payment against an order.
- Validates:
  - `amount > 0`
  - Referenced `orderId` exists.
  - Referenced `customerId` matches the order's customer.
  - `amount` does not exceed the order's remaining outstanding balance.
- Supported methods: `CASH`, `UPI`, `BANK_TRANSFER`, `CHEQUE`.

### `GET /payments`
- Returns list of payment transactions with filters (`orderId`, `customerId`, `paymentMethod`, date range).

### `GET /payments/:id`
- Returns payment details. Payments cannot be hard-deleted.


## Reports

### `GET /reports/sales`
- Aggregates completed sales revenue, order counts, and averages for `TODAY`, `THIS_WEEK`, `THIS_MONTH`, or custom range.

### `GET /reports/orders`
- Summarizes order volumes and fulfillment metrics.

### `GET /reports/inventory`
- Summarizes stock turnover, stock-in volumes, damaged tile counts, and adjustments.

### `GET /reports/customers`
- Reports outstanding balances, top customers, and receivables.