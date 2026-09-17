/**
 * Communication permission — how the dealership may REPLY.
 *
 * This is deliberately separate from the channel a message arrived on. A
 * customer emailing the support address does not give permission to email them
 * back. The supplied record is the only authority here.
 */

import type { Customer } from "@/lib/types";

export type ChannelDecision = {
  emailAllowed: boolean;
  callbackRequired: boolean;
  reason: string;
};

export function channelPolicy(customer: Customer): ChannelDecision {
  if (customer.contactPermission === "callback only") {
    return {
      emailAllowed: false,
      callbackRequired: true,
      reason: `${customer.id} is set to 'callback only'. No reply may be emailed — including appointment details. A telephone callback is required.`,
    };
  }

  if (customer.contactPermission === "service updates only") {
    return {
      emailAllowed: true,
      callbackRequired: false,
      reason: `${customer.id} is set to 'service updates only'. A service update may be emailed; nothing else may be.`,
    };
  }

  // Anything unrecognised is treated as the most restrictive option, never the
  // most permissive.
  return {
    emailAllowed: false,
    callbackRequired: true,
    reason: `${customer.id} has an unrecognised communication permission ('${customer.contactPermission}'). Treated as no-email until an employee confirms it.`,
  };
}
