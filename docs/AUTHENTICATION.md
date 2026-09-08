# Authentication

## V1 User

Only the business owner can login.

Customers do not login.

Staff accounts are not part of V1.

---

# Login

The owner provides:

- Email/username as defined during implementation
- Password

The backend authenticates the user.

---

# Password

Passwords must never be stored in plaintext.

Use an established password hashing algorithm/library.

Never return password hashes through an API.

---

# Session / Authentication Credentials

Authentication must use secure server-compatible credential handling.

Authentication credentials must not be exposed unnecessarily to frontend JavaScript.

Production cookies must use appropriate security settings such as:

- HttpOnly
- Secure
- appropriate SameSite configuration
- appropriate expiration

---

# Logout

The owner must be able to logout.

Authentication credentials/session must be invalidated appropriately.

---

# Protected Routes

Business application routes require authentication.

Examples:

- /dashboard
- /products
- /inventory
- /customers
- /orders
- /payments
- /reports

The backend must enforce authentication.

Frontend route protection alone is not sufficient.