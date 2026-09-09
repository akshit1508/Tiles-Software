# Security Requirements

## Transport

Production traffic must use HTTPS/TLS.

---

# Authentication

- Hash passwords securely with bcrypt.
- Never store plaintext passwords.
- No public user registration or signup endpoint in V1.
- Initial owner account provisioned exclusively via CLI seed command (`npm run seed:admin`) reading environment variables.
- Protect authentication credentials using secure, HttpOnly, SameSite cookies.
- Implement logout and session invalidation.
- Rate-limit authentication endpoints to prevent brute-force attacks.

---

# Concurrency & Data Integrity

- Atomic order creation: Order creation, stock verification, and stock deduction must execute in an atomic transaction to prevent race conditions or overselling.
- Atomic order numbering: Order numbers (`GT-YYYYMMDD-XXXX`) must be generated using an atomic MongoDB counter (`findOneAndUpdate`) so concurrent requests cannot generate duplicate numbers.
- Cancellation idempotency: Cancellation must be atomic and idempotent, preventing multiple stock reversals for the same order.
- Business history preservation: Orders, payments, and inventory transactions must never be hard-deleted. Products must use soft deactivation (`isActive: false`).

---

# Authorization

Every protected backend operation must verify the authenticated user.

Never trust:

- frontend role values
- hidden buttons
- client-side permissions

---

# Input Validation

Validate all external input on the backend.

Examples:

- product data
- customer data
- order data
- payment data
- inventory quantities

---

# Database Security

MongoDB credentials must remain server-side.

Never expose MongoDB connection strings to the browser.

Use least-privilege database credentials.

---

# Secrets

Never commit:

- passwords
- API keys
- database credentials
- authentication secrets
- production environment variables

Use environment variables/secrets management.

---

# Error Handling

Do not expose:

- stack traces
- database credentials
- password information
- internal secrets

through production API responses.

---

# Inventory Security

Inventory modifications must be authenticated.

Important inventory changes should maintain history.

---

# Financial Data

Order amounts and payment amounts must be validated server-side.

Never trust totals calculated only by the browser.

The backend must calculate/verify important financial values.

---

# Logging

Important business/security events should be logged appropriately.

Logs must not unnecessarily contain sensitive information.