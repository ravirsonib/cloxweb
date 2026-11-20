import { http } from '@/lib/http';

export type EwdActivityType = 'WORK' | 'REST';
export type EwdBreachSeverity = 'MINOR' | 'SUBSTANTIAL' | 'SEVERE' | 'CRITICAL';
export type DailySheetStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'VERIFIED';

export type EwdBreachItem = {
  ruleName: string;
  severity: EwdBreachSeverity;
  description: string;
  actualMinutes: number;
  allowableMinutes: number;
};

export type EwdFatigueStatus = {
  currentActivity: EwdActivityType;
  currentDurationMinutes: number;
  minutesUntilBreakRequired: number;
  remainingSeconds: number;
  currentDurationSeconds: number;
  minRestMinutes: number;
  workLimitMinutes: number;
  breakRequiredAt?: string | null;
  activityStartedAt?: string | null;
  workMinutesLast24h: number;
  restMinutesLast24h: number;
  continuousRestMinutesLast24h: number;
  potentialBreaches: EwdBreachItem[];
};

export type EwdWorkRestRecord = {
  id: string;
  activity: EwdActivityType;
  workType: string | null;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  vehicleRego: string | null;
  locationStart: string | null;
  locationEnd: string | null;
  isEdited: boolean;
  editReason: string | null;
};

export type EwdDailySheet = {
  id: string;
  date: string;
  timezone: string;
  totalWorkMinutes: number;
  totalRestMinutes: number;
  status: DailySheetStatus;
  driverSignature: string | null;
  signedAt: string | null;
  declarationText: string | null;
};

export type EwdRoadsidePin = {
  id: string;
  accessPin: string;
  expiresAt: string;
  isActive: boolean;
};

export type SwitchEwdActivityInput = {
  activity: EwdActivityType;
  workType?: 'DRIVING' | 'OTHER';
  vehicleRego?: string;
  odometer?: number;
  location?: string;
  latitude?: number;
  longitude?: number;
};

export type ManualEwdRecordInput = {
  activity: EwdActivityType;
  workType?: 'DRIVING' | 'OTHER';
  startTime: string;
  endTime: string;
  vehicleRego?: string;
  locationStart?: string;
  locationEnd?: string;
  editReason: string;
};

export const EWD_SCHEDULE_A_DECLARATION =
  'I declare that the records in this Electronic Work Diary are a true and correct record of my work and rest hours under the Heavy Vehicle National Law. I understand that giving false or misleading information is a serious offence under section 701 of the HVNL with heavy penalties.';

export function getEwdStatus() {
  return http.get<EwdFatigueStatus>('/driver/ewd/status').then((r) => r.data);
}

export function switchEwdActivity(body: SwitchEwdActivityInput) {
  return http
    .post<{ record: EwdWorkRestRecord; breaches: EwdBreachItem[] }>('/driver/ewd/activity', body)
    .then((r) => r.data);
}

export function listEwdRecords(days = 7) {
  return http
    .get<EwdWorkRestRecord[]>('/driver/ewd/records', { params: { days } })
    .then((r) => r.data);
}

export function createManualEwdRecord(body: ManualEwdRecordInput) {
  return http.post<EwdWorkRestRecord>('/driver/ewd/records', body).then((r) => r.data);
}

export function getEwdTodaySheet() {
  return http.get<EwdDailySheet>('/driver/ewd/sheet/today').then((r) => r.data);
}

export function signEwdDailySheet(body: { date: string; signature: string }) {
  return http.post<EwdDailySheet>('/driver/ewd/sheet/sign', body).then((r) => r.data);
}

export function generateEwdRoadsidePin() {
  return http.post<EwdRoadsidePin>('/driver/ewd/roadside/pin').then((r) => r.data);
}
