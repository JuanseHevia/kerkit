import type { AuthorizationStatus } from '../entities/authorization.js';
import type { PrescriptionStatus } from '../entities/prescription.js';

/**
 * Deadline for having an authorization confirmed: a margin of hours before
 * the appointment it unblocks.
 */
export function calculateAuthDeadline(appointmentDate: Date, hoursBefore = 48): Date {
  const deadline = new Date(appointmentDate);
  deadline.setHours(deadline.getHours() - hoursBefore);
  return deadline;
}

export function isEscalationNeeded(
  deadline: Date,
  currentStatus: AuthorizationStatus,
  now: Date = new Date(),
): boolean {
  return now >= deadline && currentStatus !== 'confirmed';
}

/**
 * Expiry date of a prescription document. Validity is a locale rule
 * (30 days for a receta in Argentina) — supply it from your locale pack.
 */
export function calculateExpiryDate(dateIssued: Date, validityDays: number): Date {
  const expiry = new Date(dateIssued);
  expiry.setDate(expiry.getDate() + validityDays);
  return expiry;
}

/**
 * Status of a prescription document relative to its expiry:
 * 'expiring' once inside the alert window, 'expired' past the date.
 */
export function getPrescriptionStatus(
  dateExpires: Date,
  opts: { alertWindowDays: number; now?: Date },
): PrescriptionStatus {
  const now = opts.now ?? new Date();
  if (now > dateExpires) return 'expired';
  const daysUntilExpiry = Math.ceil((dateExpires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilExpiry <= opts.alertWindowDays) return 'expiring';
  return 'active';
}
