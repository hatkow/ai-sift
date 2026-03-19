export type Role = "admin" | "office" | "viewer";
export type ScheduleStatus = "draft" | "confirmed" | "cancelled";
export type SourceType = "manual" | "auto" | "copied" | "reassigned";
export type AbsenceType = "有休" | "欠勤" | "研修" | "半休" | "時間不可";
export type SchedulerMode = "new" | "rebalance" | "absence";

export type User = {
  id: string;
  loginId: string;
  password: string;
  name: string;
  role: Role;
  isActive: boolean;
};

export type Staff = {
  id: string;
  staffCode: string;
  name: string;
  kana: string;
  department: string;
  position: string;
  employmentType: "常勤" | "非常勤";
  workDays: number[];
  workStartTime: string;
  workEndTime: string;
  lunchBreakMinutes: number;
  maxVisitPerDay: number;
  maxWorkMinutesPerDay: number;
  serviceAreas: string[];
  preferredClientIds: string[];
  blockedClientIds: string[];
  mailAddress: string;
  isActive: boolean;
  remarks: string;
};

export type Client = {
  id: string;
  clientCode: string;
  name: string;
  kana: string;
  gender: string;
  birthDate: string;
  postalCode: string;
  address: string;
  area: string;
  phone: string;
  emergencyContact: string;
  contractStartDate: string;
  contractEndDate?: string;
  isActive: boolean;
  defaultWeekdays: number[];
  preferredTimeWindow: { start: string; end: string };
  defaultDurationMinutes: number;
  frequencyPerWeek: number;
  priorityStaffId?: string;
  candidateStaffIds: string[];
  ngStaffIds: string[];
  requiresPairVisit: boolean;
  notes: string;
  careNotes: string;
  carryOverFromPreviousMonth: boolean;
};

export type StaffAbsence = {
  id: string;
  staffId: string;
  date: string;
  type: AbsenceType;
  startTime: string;
  endTime: string;
  reason: string;
  emergency: boolean;
};

export type Schedule = {
  id: string;
  clientId: string;
  staffId?: string;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  status: ScheduleStatus;
  sourceType: SourceType;
  note?: string;
  warningCodes: string[];
};

export type ChangeLog = {
  id: string;
  scheduleId: string;
  changedBy: string;
  changeType: string;
  beforeJson: string;
  afterJson: string;
  reason: string;
  notifiedAt?: string;
  createdAt: string;
};

export type NotificationLog = {
  id: string;
  scheduleId: string;
  targetStaffId: string;
  channel: "email";
  sendStatus: "queued" | "sent";
  sentAt?: string;
  messageBody: string;
};

export type SystemSettings = {
  standardTravelMinutes: number;
  continuityScore: number;
  areaMatchScore: number;
  balancingScore: number;
  emergencyRangeHours: number;
};

export type SchedulerResult = {
  schedules: Schedule[];
  unassigned: Schedule[];
  conflicts: { scheduleId: string; reasons: string[] }[];
  adjustments: string[];
};
