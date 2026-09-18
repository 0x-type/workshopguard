# Adapting WorkshopGuard for another garage

WorkshopGuard demonstrates an integration pattern, not a drop-in production system.

## Systems to connect

A garage would need to connect:

1. customer or CRM records;
2. the workshop job system;
3. the quality-check process;
4. preferred communication channels;
5. employee identities and permissions;
6. the real booking system.

## Rules to configure

Each organisation would define its job statuses, employee roles, approval rules, communication permissions, supported languages, collection requirements and email or messaging providers. Multi-location workshops would also need clear ownership and routing for each site.

## Recommended adoption sequence

1. Map the systems that hold customer, job, quality and contact-permission facts.
2. Name the owner and freshness requirement for each fact.
3. Reproduce one high-risk contradiction with synthetic data.
4. Validate deterministic rules with service advisers, technicians and inspectors.
5. Connect read-only data first and measure how often conflicts occur.
6. Add employee identity, authentication and narrowly scoped write actions.
7. Pilot one permitted outbound channel with monitoring and rollback.

## Production controls still required

A production deployment needs real authentication, authorisation tied to an identity provider, durable storage, retention and deletion policy, encryption and secret management, rate limits, observability, integration retries, accessibility and security testing, data-protection review and operational ownership.

The first validation question is behavioural: when WorkshopGuard blocks a promise that another system appears to support, will a busy adviser trust the evidence and wait for the correct employee?
