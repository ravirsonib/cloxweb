export type IdentityMe = {
  kind: 'admin' | 'user';
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  /** Preferred UI / notification locale: en | hi | pa */
  locale?: 'en' | 'hi' | 'pa';
  role: string;
  active?: boolean;
  status?: string;
  companyId?: string | null;
  opsEligible?: boolean;
  scopes?: Array<{
    scopeType: string;
    regionCode: string | null;
    territoryCode: string | null;
  }>;
  company?: {
    id: string;
    type: string;
    legalName: string | null;
    status: string;
    reliabilityScore?: number;
  } | null;
  driver?: {
    id: string;
    status: string;
    reliabilityScore?: number;
  } | null;
};
