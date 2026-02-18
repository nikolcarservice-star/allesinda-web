# Allesinda — FastAPI Backend

FastAPI backend for the Allesinda three-sided marketplace.

## Email notifications (new messages)

When a user receives a new chat message, an email notification can be sent. Configure SMTP in your environment (e.g. `.env`):

- `SMTP_HOST` — e.g. `smtp.gmail.com`
- `SMTP_PORT` — e.g. `587` (TLS) or `465` (SSL)
- `SMTP_USER` — sender/login email
- `SMTP_PASSWORD` — password or app password (for Gmail use [App Password](https://myaccount.google.com/apppasswords))
- `FRONTEND_URL` — base URL of the frontend (used for “Open messages” link in the email, e.g. `https://yoursite.com`)

See `.env.sample` for a template. If SMTP is not set, in-app and push behaviour is unchanged; only the email is skipped.
