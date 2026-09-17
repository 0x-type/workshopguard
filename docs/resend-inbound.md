# Resend inbound email — setup

Receiving real email is **optional** (P2 in the plan). The demo does not depend
on it: the clearly-labelled *Simulate an incoming email* button covers the same
path, and the brief explicitly allows that.

Everything below is already implemented. What is left is configuration.

---

## The one thing that makes this awkward

A webhook is Resend calling **you**. `http://localhost:3000` is not reachable
from the internet, so Resend cannot call it. You need a public URL:

- a tunnel to your laptop (quickest), or
- a deployment (Vercel etc.)

That is the only real obstacle. Everything else is a few minutes of clicking.

---

## 1. Point your domain's mail at Resend

`nassim0x.com` is already verified for **sending**. Receiving is separate and
needs an **MX record**.

In the Resend dashboard: **Emails → Receiving**, enable receiving for
`nassim0x.com`, and add the MX record it gives you to your DNS.

> ⚠️ An MX record controls **all** mail for that domain. If `nassim0x.com`
> already receives real email, do **not** point its MX at Resend. Use a
> subdomain instead — e.g. `inbound.nassim0x.com` — and send test mail to
> `service@inbound.nassim0x.com`.
>
> For a demo you can skip DNS entirely: Resend gives every account a receiving
> address of the form `anything@<id>.resend.app`. Find it under
> **Emails → Receiving → ⋯**. Nothing to configure, and no risk to your real mail.

## 2. Expose your local server

```bash
# Option A — cloudflared (no account needed)
brew install cloudflared
cloudflared tunnel --url http://localhost:3000
# prints e.g. https://random-words-1234.trycloudflare.com

# Option B — ngrok
ngrok http 3000
```

Leave it running. The URL changes each restart on the free tiers, so you will
re-paste it into Resend if you restart the tunnel.

## 3. Create the webhook

Resend dashboard → **Webhooks → Add Webhook**:

- **Endpoint URL**: `https://<your-tunnel>/api/inbound/resend`
- **Event**: `email.received` (this one only)

Copy the **signing secret** it shows you (`whsec_…`) into `.env`:

```env
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx
```

Restart the dev server — Next.js reads `.env` at startup.

## 4. Send yourself a test

```
To:      service@inbound.nassim0x.com   (or your @<id>.resend.app address)
Subject: Question about JOB-1
Body:    Hello, this is CUS-A about JOB-1. Is my car ready?
```

Within a second or two the message appears in `/employee`, tagged
**`real inbound`**, and the live notification fires.

---

## What the code does with it

`app/api/inbound/resend/route.ts` → `lib/email/inbound.ts`

1. **Reads the raw body.** Signature verification is over exact bytes; parsing
   and re-stringifying would break it. That is why the route reads `req.text()`
   and the runtime is pinned to `nodejs`.

2. **Verifies the Svix signature** (`svix-id`, `svix-timestamp`,
   `svix-signature`) against `RESEND_WEBHOOK_SECRET`. This endpoint is public —
   without this, anyone who found the URL could inject messages into the
   dealership's inbox. No secret configured ⇒ every request is refused (503).
   Bad signature ⇒ 401, and the response says nothing useful to the caller.

3. **Fetches the body separately.** Resend's webhook carries *metadata only* —
   no body, no attachments. `GET /emails/receiving/{id}` returns `text` and
   `html`; the code prefers `text` and falls back to stripped HTML.

4. **Reads references as a hint, never as proof.** `CUS-A` / `JOB-1` are pulled
   out of the subject and body, then handed to the same `matchMessage()` every
   other channel uses. **The sender's address is stored for the employee to read
   and is never used to identify anybody.** An email claiming to be Customer A
   while quoting Customer B's case is refused — there is a test for exactly that.

5. **Ignores webhook retries** by remembering Resend's `email_id`, so a retry
   does not create a duplicate message.

An inbound email that cannot be tied to one verified case lands as
**Manual review required** with its text preserved — identical to the simulated
failure path, because it goes through identical rules.

---

## If you skip all of this

Nothing breaks. `RESEND_WEBHOOK_SECRET` unset means the endpoint refuses
everything, and the *Simulate an incoming email* button demonstrates the same
flow with a clear SIMULATED label.
