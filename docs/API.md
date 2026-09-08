# API Plan

## Authentication

POST /auth/login

POST /auth/logout

GET /auth/me


## Products

POST /products

GET /products

GET /products/:id

PATCH /products/:id

DELETE /products/:id


## Inventory

GET /inventory

GET /inventory/:productId

POST /inventory/stock-in

POST /inventory/adjustment

POST /inventory/damage

GET /inventory/:productId/history


## Customers

POST /customers

GET /customers

GET /customers/:id

PATCH /customers/:id


## Orders

POST /orders

GET /orders

GET /orders/:id

PATCH /orders/:id


## Payments

POST /payments

GET /payments

GET /payments/:id


## Reports

GET /reports/sales

GET /reports/orders

GET /reports/inventory

GET /reports/customers