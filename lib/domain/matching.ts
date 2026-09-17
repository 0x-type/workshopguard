/**
 * Customer and case matching.
 *
 * Supplied rule: "Use customer IDs, never guessed identity matches."
 *
 * A message is verified ONLY when it carries both a customer ID and a case
 * reference, both exist, and the case belongs to that customer. A name, an email
 * address or a vehicle plate never establishes identity here — not even when
 * there is exactly one plausible candidate. An unverifiable message stops at
 * manual review with its original text intact.
 */

import type { Case, Customer, MatchResult } from "@/lib/types";

export type Matchable = {
  claimedCustomerId?: string;
  claimedCaseRef?: string;
};

export function matchMessage(
  item: Matchable,
  record: { customers: Customer[]; cases: Case[] },
): MatchResult {
  const { claimedCustomerId, claimedCaseRef } = item;

  if (!claimedCustomerId && !claimedCaseRef) {
    return {
      status: "unverified",
      reason:
        "No customer ID and no case reference were supplied. Identity is never inferred from a name, email address or vehicle plate.",
    };
  }

  if (!claimedCustomerId) {
    return {
      status: "unverified",
      reason: `Case reference ${claimedCaseRef} was supplied without a customer ID, so the sender cannot be verified.`,
    };
  }

  if (!claimedCaseRef) {
    return {
      status: "unverified",
      reason: `Customer ${claimedCustomerId} was supplied without a case reference, so the message cannot be tied to exactly one case.`,
    };
  }

  const customer = record.customers.find((c) => c.id === claimedCustomerId);
  if (!customer) {
    return {
      status: "unverified",
      reason: `Customer ID ${claimedCustomerId} does not exist in the record.`,
    };
  }

  const caseRecord = record.cases.find((c) => c.id === claimedCaseRef);
  if (!caseRecord) {
    return {
      status: "unverified",
      reason: `Case reference ${claimedCaseRef} does not exist in the record.`,
    };
  }

  if (caseRecord.customerId !== customer.id) {
    return {
      status: "unverified",
      reason: `Case ${caseRecord.id} does not belong to customer ${customer.id}. Access refused.`,
    };
  }

  return {
    status: "verified",
    customerId: customer.id,
    caseId: caseRecord.id,
    reason: `Matched on customer ID ${customer.id} and case reference ${caseRecord.id}.`,
  };
}
