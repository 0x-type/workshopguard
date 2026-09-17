/**
 * The one-way projection a customer is allowed to see.
 *
 * Nothing reaches the portal except through this function. It never emits CRM
 * state, internal notes, evidence, unapproved drafts, employee identities or
 * anything belonging to another customer — and a test asserts that by scanning
 * the serialised payload.
 */

import type { Case, Customer, Dealership, Draft, CallbackTask } from "@/lib/types";
import { evaluateCase } from "@/lib/domain/rules";

export type StageState = "done" | "in progress" | "not yet";

export type PublicStage = {
  key: string;
  label: string;
  state: StageState;
  note: string;
};

export type PublicAppointment = {
  slot: string;
  status: string;
  requestedSlot?: string;
  changeState: "none" | "requested" | "approved";
  note: string;
  /** A visit can only be moved while the vehicle is still with the customer. */
  canReschedule: boolean;
  rescheduleBlockedReason?: string;
};

export type PublicCase = {
  caseRef: string;
  stages: PublicStage[];
  collectionConfirmed: boolean;
  collectionHeadline: string;
  collectionNote: string;
  appointment?: PublicAppointment;
  approvedMessages: { at: string; body: string }[];
  callback?: { state: "open" | "completed"; note: string };
  /** True while a callback is already queued, so the portal stops offering another. */
  callbackPending: boolean;
};

export type PublicView = {
  customerLabel: string;
  communicationPreference: string;
  preferredLanguage: string;
  dealershipName: string;
  productName: string;
  disclaimer: string;
  logo: string;
  dealershipPhone: string;
  cases: PublicCase[];
};

function repairStages(caseRecord: Case): PublicStage[] {
  const e = evaluateCase(caseRecord);

  const workDone = e.workshopWork === "finished";
  const qualityDone = e.qualityCheck === "passed";
  const qualityFailed = e.qualityCheck === "failed";

  return [
    {
      key: "repair",
      label: "Repair work",
      state: workDone ? "done" : "in progress",
      note: workDone ? "The work on your vehicle is complete." : "Your vehicle is with our workshop.",
    },
    {
      key: "quality",
      label: "Quality check",
      state: qualityDone ? "done" : !workDone ? "not yet" : "in progress",
      note: qualityDone
        ? "Your vehicle has passed its final check."
        : qualityFailed
          ? "Our team is carrying out some further work before this can be completed."
          : !workDone
            ? "This happens once the repair work is finished."
            : "Our team is completing the final check on your vehicle.",
    },
    {
      key: "collection",
      label: "Ready for collection",
      state: e.collectionConfirmed ? "done" : "not yet",
      note: e.collectionConfirmed
        ? "Your vehicle is ready. Please come in at your convenience."
        : "We will contact you to arrange a time as soon as your vehicle is cleared.",
    },
  ];
}

function appointmentStages(caseRecord: Case): PublicStage[] {
  const changed = caseRecord.appointment?.changeStatus ?? "none";
  return [
    {
      key: "booked",
      label: "Appointment booked",
      state: "done",
      note: `Your appointment is booked for ${caseRecord.appointment?.slot ?? "a confirmed slot"}.`,
    },
    {
      key: "change",
      label: "Change requested",
      state: changed === "employee-approved" ? "done" : changed === "requested" ? "in progress" : "not yet",
      note:
        changed === "employee-approved"
          ? "Your new time has been agreed and applied."
          : changed === "requested"
            ? "We have your request. It is not confirmed until a service adviser agrees it with you."
            : "No change has been requested.",
    },
    {
      key: "visit",
      label: "Service visit",
      state: "not yet",
      note: "We will see you at your appointment.",
    },
  ];
}

function projectCase(
  caseRecord: Case,
  drafts: Draft[],
  callbacks: CallbackTask[],
): PublicCase {
  const e = evaluateCase(caseRecord);
  const isAppointment = Boolean(caseRecord.appointment);

  // ONLY approved responses. A suggestion an employee has not signed off is
  // never shown to the customer.
  const approvedMessages = drafts
    .filter((d) => d.caseId === caseRecord.id && d.status === "approved")
    .map((d) => ({ at: d.approvedAt ?? "", body: d.editedBody ?? d.body }));

  const openCallback = callbacks
    .filter((t) => t.caseId === caseRecord.id)
    .sort((a, b) => (a.status === "open" ? -1 : 1))[0];

  // Once the vehicle is with the workshop there is nothing left to reschedule,
  // and a pending request must be settled on the call before another is taken.
  const vehicleWithUs = /workshop|in progress|work/i.test(caseRecord.workshopState) &&
    !/appointment/i.test(caseRecord.workshopState);
  const alreadyRequested = caseRecord.appointment?.changeStatus === "requested";

  const appointment: PublicAppointment | undefined = caseRecord.appointment
    ? {
        slot: caseRecord.appointment.slot,
        status: caseRecord.appointment.bookingStatus,
        requestedSlot: caseRecord.appointment.requestedSlot,
        canReschedule: !vehicleWithUs && !alreadyRequested,
        rescheduleBlockedReason: vehicleWithUs
          ? "Your vehicle is already with us, so this visit can no longer be moved. Please call us."
          : alreadyRequested
            ? "We already have a change request from you. We will call you to agree it before you send another."
            : undefined,
        changeState:
          caseRecord.appointment.changeStatus === "employee-approved"
            ? "approved"
            : caseRecord.appointment.changeStatus === "requested"
              ? "requested"
              : "none",
        note:
          caseRecord.appointment.changeStatus === "requested"
            ? "Requested — not confirmed. A service adviser will agree this with you before anything changes."
            : caseRecord.appointment.changeStatus === "employee-approved"
              ? "Your new time has been agreed."
              : "This is your confirmed appointment.",
      }
    : undefined;

  return {
    caseRef: caseRecord.id,
    stages: isAppointment ? appointmentStages(caseRecord) : repairStages(caseRecord),
    collectionConfirmed: e.collectionConfirmed,
    collectionHeadline: e.collectionConfirmed
      ? "Ready to collect"
      : isAppointment
        ? "Appointment booked"
        : "Not ready yet",
    collectionNote: e.collectionConfirmed
      ? "Your vehicle has passed all its checks and has been released for collection."
      : isAppointment
        ? "We look forward to seeing you."
        : "Your vehicle has not been cleared for collection yet. We will let you know as soon as it is.",
    appointment,
    approvedMessages,
    callbackPending: openCallback?.status === "open",
    callback: openCallback
      ? {
          state: openCallback.status,
          note:
            openCallback.status === "open"
              ? "We have your callback request and will telephone you."
              : "We have spoken with you about this.",
        }
      : undefined,
  };
}

export function buildPublicView(
  customer: Customer,
  cases: Case[],
  drafts: Draft[],
  callbacks: CallbackTask[],
  dealership: Dealership,
): PublicView {
  // Scoped to this customer's own cases. Nothing else can reach the projection.
  const own = cases.filter((c) => c.customerId === customer.id);

  return {
    customerLabel: customer.displayLabel,
    communicationPreference: customer.contactPermission,
    preferredLanguage: customer.preferredLanguage,
    dealershipName: dealership.name,
    productName: dealership.productName,
    disclaimer: dealership.disclaimer,
    logo: dealership.logo,
    dealershipPhone: dealership.phone,
    cases: own.map((c) => projectCase(c, drafts, callbacks)),
  };
}
