# Safety boundaries

WorkshopGuard separates language assistance from decisions that can create a customer promise.

## AI may

- identify likely intent and language;
- summarise a conversation;
- select relevant supplied facts for a draft;
- prepare a multilingual response;
- explain missing or conflicting information in plain language.

## AI may not

- establish customer identity;
- grant communication permission;
- complete a repair or physical quality check;
- decide that collection is allowed;
- approve or send its own response;
- confirm a booking or vehicle collection.

## Deterministic controls

Customer matching requires both a customer ID and case reference whose ownership agrees. A single permission table governs UI and API actions. Conflict rules compare CRM, workshop and quality-check state. Collection requires finished repair work, a passed quality check, no unresolved conflict and an authorised service-adviser action.

The promise guardrail checks the model's draft and checks again after an employee edits it. Unsupported collection wording is refused. Missing or contradictory identity information stops at manual review, with the original message preserved.

## Human approval

Technicians update repair work. Quality inspectors own the final check. Service advisers own customer responses and collection confirmation. Permission denials and important mutations are recorded in the audit history.

## Evidence and failure behaviour

Recommendations show the facts, their sources, the applied rules and detected conflicts. A live AI failure falls back to a labelled deterministic drafter when enabled; otherwise the item stops for manual handling. Email failures preserve approved wording for retry. The safe default is to stop and disclose the missing capability, never guess.
