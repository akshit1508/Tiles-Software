# Security Requirements

## Transport

Production traffic must use HTTPS/TLS.

---

# Authentication

- Hash passwords securely.
- Never store plaintext passwords.
- Protect authentication credentials.
- Implement logout.
- Rate-limit authentication endpoints.

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