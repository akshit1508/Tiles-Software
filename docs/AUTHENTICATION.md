# Authentication

## V1 User

Only the business owner can login.

Customers do not login.

Staff accounts are not part of V1.

---

# User Provisioning (Owner Account)

There is NO public registration or signup endpoint in V1.

The owner account is created or updated exclusively via a dedicated NestJS CLI seed command:

```bash
npm run seed:admin
```

This command:
1. Reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from environment variables.
2. Validates email format and password strength.
3. Generates a secure salted hash using `bcrypt`.
4. Creates or updates the `users` document with `role: 'OWNER'` and `isActive: true`.
5. Never exposes or stores the plaintext password.

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