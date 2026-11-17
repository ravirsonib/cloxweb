/**
 * Shared partner label for Ops lists — match Admin partners & Partner performance.
 * Prefer company legal name, then person name, then email.
 */
export function adminPartnerDisplayName(partner: {
  email: string;
  name?: string | null;
  company?: { legalName?: string | null } | null;
  companyLegalName?: string | null;
}): string {
  const companyName =
    partner.company?.legalName?.trim() || partner.companyLegalName?.trim() || '';
  const personName = partner.name?.trim() || '';
  return companyName || personName || partner.email;
}
