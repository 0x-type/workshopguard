# Limitations and next validation steps

## Current limitations

- State is an in-memory singleton with a local runtime snapshot, not a production database.
- Employee profiles are a demonstration switch, not authentication.
- Portal access uses customer ID plus case reference, not secure customer authentication.
- The seeded dataset contains two synthetic customers and two cases; scale is untested.
- Appointment days and times are exercise-local rather than real calendar dates.
- The workspace polls for updates instead of using a production push channel.
- Telephone calling and external booking updates are simulated.
- Outbound email can reach only one configured test address.
- Inbound email requires a publicly reachable, signature-verified webhook.
- The system performs no vehicle diagnosis.
- WhatsApp is not implemented.

## Next production validation steps

1. Run a supervised, read-only pilot against one garage's current job, CRM and quality sources.
2. Measure conflict frequency, stale-data frequency and false blocks.
3. Test whether service advisers understand and trust the evidence under time pressure.
4. Validate role ownership with technicians, quality inspectors and service managers.
5. Threat-model customer matching, portal authentication and webhook processing.
6. Test multilingual drafts and promise detection with domain experts and representative phrasing.
7. Define retention, audit access, incident response and human override policy before any live messaging.

The prototype proves that the supplied contradiction can be detected and governed. It does not yet prove production reliability, organisational adoption or compliance for a particular garage.
