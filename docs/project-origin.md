# Project origin

WorkshopGuard was originally designed and built in six hours during **DaiL Octopus Day 2026** for case C01, “The customer who keeps calling.”

The six-hour build focused on one complete workflow: receiving a customer question, detecting conflicting workshop information, preparing a safe multilingual response, involving the appropriate employees and recording the final decision.

The functional prototype was created during the event. GitHub documentation, generic WorkshopGuard branding and repository presentation were refined afterward.

## Challenge material and scope

The supplied C01 material describes a fictional vehicle-workshop communication problem and contains synthetic records. WorkshopGuard keeps `C01/initial.json` read-only and layers labelled demonstration data around it. The application does not contact real customers and is not connected to a real garage.

The core design choice from the six-hour build remains unchanged: AI helps with language, while deterministic code and named employees control identity, permissions, conflicts and customer promises.
