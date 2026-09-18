# Communication channels

WorkshopGuard sends every incoming channel through the same identity, evidence, permission and approval pipeline.

> The channel through which a message arrives is not necessarily the channel through which the garage is permitted to respond.

| Channel | Incoming | Outgoing | Current status |
| --- | --- | --- | --- |
| Customer portal | Yes | Safe status and approved messages | Implemented demo |
| Email | Yes | Employee-approved email | Implemented with test restrictions |
| Telephone | Phone notes | Manual callback task | Simulated |
| WhatsApp | Not yet | Not yet | Roadmap |

## Customer portal

Customers see a deliberately limited projection of vehicle or appointment status, can send messages and can request another appointment time. A requested time is not automatically confirmed. Customer ID plus case reference is demonstration access, not production authentication; a deployment would need signed, expiring links or a real identity system.

## Inbound email

Resend delivers email to a signature-verified webhook. The system extracts customer and case references as hints, then applies the same deterministic ownership check used by other channels. Missing or contradictory identities require manual review and preserve the original message. The sender's address is not identity proof, and receiving email does not automatically permit an email response. See [Resend inbound setup](resend-inbound.md).

## Outbound email

AI prepares a draft in the customer's preferred language. Deterministic rules check it for unsupported promises, and an authorised service adviser must review and approve it. Real sending is restricted to exactly one configured allow-listed test address; no real customer address is used.

## Callback workflow

For a callback-only customer, WorkshopGuard creates a callback task instead of sending email. An employee completes the call manually and records the result. Telephone calling is simulated in this prototype.

Customer B demonstrates the distinction: the request arrives through the portal, but the customer's recorded communication preference requires a telephone callback.

## WhatsApp roadmap

WhatsApp Business is planned, not implemented. A future WhatsApp message would enter the existing inbox, be matched to a verified customer and job, be checked against current workshop evidence, follow the customer's communication permissions, stop for manual review when uncertain and leave only after employee approval. WhatsApp would wrap the existing decision pipeline rather than create a second one.
