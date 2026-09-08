# Tile Management System — Product Requirements

## 1. Product Overview

The Tile Management System is a private web-based business management application for a single tile shop.

The purpose of the application is to replace manual tracking of:

- Tile stock
- Customers
- Orders
- Payments
- Outstanding amounts
- Sales
- Reports

The application will provide a centralized source of business information accessible through the internet.

---

# 2. Users

## Owner

The business owner is the only application user in V1.

The owner can:

- Login
- Manage products
- Manage inventory
- Manage customers
- Create and manage orders
- Record payments
- View outstanding amounts
- View sales
- View reports

Customers do not have accounts.

---

# 3. Product Management

The owner can:

- Add products
- View products
- Search products
- Filter products
- Edit products
- Deactivate products
- View product details
- Upload product images

Product fields:

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

---

# 4. Inventory Management

The system must track tile inventory in:

- Boxes
- Pieces
- Square Feet

The owner can:

- Add stock
- Remove stock through sales
- Record damaged stock
- Make stock adjustments
- View stock history
- View current stock
- Identify low-stock products

The system must support partial/open boxes.

---

# 5. Customer Management

The owner can:

- Add customers
- Edit customers
- Search customers
- View customer details
- View customer order history
- View payment history
- View outstanding amount

Customer fields:

- Name
- Phone
- Address

---

# 6. Order Management

The owner can:

- Create an order
- View orders
- Search orders
- View order details
- Update order status
- Record payments

An order may contain multiple products.

Products can be sold by:

- Boxes
- Pieces
- Square Feet

Orders may be:

- Fully paid
- Partially paid
- Credit

---

# 7. Payment Management

Supported payment methods:

- Cash
- UPI
- Bank Transfer
- Cheque

Multiple payments can be recorded against an order/customer.

The system must maintain payment history.

---

# 8. Dashboard

The dashboard should provide a quick overview of:

- Today's sales
- Today's orders
- Total customers
- Total products
- Low-stock products
- Outstanding amount
- Recent orders

---

# 9. Reports

The owner can view reports for:

- Today
- This week
- This month
- Custom date range

Reports should include:

- Sales
- Orders
- Top-selling products
- Inventory movement
- Customers
- Outstanding payments

---

# 10. Responsive Design

The application must work on:

- Desktop
- Laptop
- Mobile

The primary interface is a business dashboard rather than a customer-facing ecommerce website.