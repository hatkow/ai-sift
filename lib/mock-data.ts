import {
  ChangeLog,
  Client,
  NotificationLog,
  Schedule,
  Staff,
  StaffAbsence,
  SystemSettings,
  User
} from "@/lib/types";

export const seedUsers: User[] = [
  {
    id: "u1",
    loginId: "admin",
    password: "admin123",
    name: "管理者 田中",
    role: "admin",
    isActive: true
  },
  {
    id: "u2",
    loginId: "office",
    password: "office123",
    name: "事務 佐藤",
    role: "office",
    isActive: true
  },
  {
    id: "u3",
    loginId: "viewer",
    password: "viewer123",
    name: "閲覧 山田",
    role: "viewer",
    isActive: true
  }
];

export const seedSettings: SystemSettings = {
  standardTravelMinutes: 20,
  continuityScore: 30,
  areaMatchScore: 20,
  balancingScore: 10,
  emergencyRangeHours: 6
};

export const seedStaffs: Staff[] = [
  {
    id: "s1",
    staffCode: "ST001",
    name: "高橋 真由",
    kana: "タカハシ マユ",
    department: "訪問看護",
    position: "看護師",
    employmentType: "常勤",
    workDays: [0, 1, 2, 3, 4],
    workStartTime: "08:30",
    workEndTime: "17:30",
    lunchBreakMinutes: 60,
    maxVisitPerDay: 5,
    maxWorkMinutesPerDay: 480,
    serviceAreas: ["北区", "中央区"],
    preferredClientIds: ["c1"],
    blockedClientIds: [],
    mailAddress: "takahashi@example.com",
    isActive: true,
    remarks: "リーダー"
  },
  {
    id: "s2",
    staffCode: "ST002",
    name: "鈴木 健",
    kana: "スズキ ケン",
    department: "訪問看護",
    position: "理学療法士",
    employmentType: "常勤",
    workDays: [0, 1, 2, 3, 4],
    workStartTime: "09:00",
    workEndTime: "18:00",
    lunchBreakMinutes: 60,
    maxVisitPerDay: 6,
    maxWorkMinutesPerDay: 480,
    serviceAreas: ["中央区", "東区"],
    preferredClientIds: ["c2"],
    blockedClientIds: ["c4"],
    mailAddress: "suzuki@example.com",
    isActive: true,
    remarks: ""
  },
  {
    id: "s3",
    staffCode: "ST003",
    name: "中村 彩",
    kana: "ナカムラ アヤ",
    department: "訪問看護",
    position: "看護師",
    employmentType: "非常勤",
    workDays: [0, 2, 4],
    workStartTime: "09:00",
    workEndTime: "16:00",
    lunchBreakMinutes: 45,
    maxVisitPerDay: 4,
    maxWorkMinutesPerDay: 360,
    serviceAreas: ["西区", "中央区"],
    preferredClientIds: [],
    blockedClientIds: [],
    mailAddress: "nakamura@example.com",
    isActive: true,
    remarks: "同行対応可"
  }
];

export const seedClients: Client[] = [
  {
    id: "c1",
    clientCode: "CL001",
    name: "青木 和子",
    kana: "アオキ カズコ",
    gender: "女",
    birthDate: "1941-06-03",
    postalCode: "100-0001",
    address: "東京都中央区1-1-1",
    area: "中央区",
    phone: "03-0000-0001",
    emergencyContact: "長男 090-0000-0001",
    contractStartDate: "2025-01-01",
    isActive: true,
    defaultWeekdays: [0, 3],
    preferredTimeWindow: { start: "09:00", end: "11:00" },
    defaultDurationMinutes: 60,
    frequencyPerWeek: 2,
    priorityStaffId: "s1",
    candidateStaffIds: ["s1", "s2"],
    ngStaffIds: [],
    requiresPairVisit: false,
    notes: "血圧確認",
    careNotes: "転倒注意",
    carryOverFromPreviousMonth: true
  },
  {
    id: "c2",
    clientCode: "CL002",
    name: "伊藤 恒一",
    kana: "イトウ コウイチ",
    gender: "男",
    birthDate: "1938-12-15",
    postalCode: "100-0002",
    address: "東京都東区2-2-2",
    area: "東区",
    phone: "03-0000-0002",
    emergencyContact: "妻 090-0000-0002",
    contractStartDate: "2024-04-01",
    isActive: true,
    defaultWeekdays: [1, 4],
    preferredTimeWindow: { start: "10:00", end: "14:00" },
    defaultDurationMinutes: 45,
    frequencyPerWeek: 2,
    priorityStaffId: "s2",
    candidateStaffIds: ["s2", "s3"],
    ngStaffIds: [],
    requiresPairVisit: false,
    notes: "リハビリ",
    careNotes: "膝痛あり",
    carryOverFromPreviousMonth: true
  },
  {
    id: "c3",
    clientCode: "CL003",
    name: "上田 里美",
    kana: "ウエダ サトミ",
    gender: "女",
    birthDate: "1948-08-22",
    postalCode: "100-0003",
    address: "東京都西区3-3-3",
    area: "西区",
    phone: "03-0000-0003",
    emergencyContact: "娘 090-0000-0003",
    contractStartDate: "2026-02-01",
    isActive: true,
    defaultWeekdays: [0, 2, 4],
    preferredTimeWindow: { start: "13:00", end: "16:00" },
    defaultDurationMinutes: 40,
    frequencyPerWeek: 3,
    candidateStaffIds: ["s1", "s3"],
    ngStaffIds: [],
    requiresPairVisit: true,
    notes: "褥瘡ケア",
    careNotes: "同行必須",
    carryOverFromPreviousMonth: false
  },
  {
    id: "c4",
    clientCode: "CL004",
    name: "岡田 進",
    kana: "オカダ ススム",
    gender: "男",
    birthDate: "1935-01-10",
    postalCode: "100-0004",
    address: "東京都北区4-4-4",
    area: "北区",
    phone: "03-0000-0004",
    emergencyContact: "長女 090-0000-0004",
    contractStartDate: "2025-09-01",
    isActive: true,
    defaultWeekdays: [1],
    preferredTimeWindow: { start: "15:00", end: "17:00" },
    defaultDurationMinutes: 50,
    frequencyPerWeek: 1,
    priorityStaffId: "s1",
    candidateStaffIds: ["s1"],
    ngStaffIds: ["s2"],
    requiresPairVisit: false,
    notes: "服薬管理",
    careNotes: "認知症あり",
    carryOverFromPreviousMonth: true
  }
];

export const seedAbsences: StaffAbsence[] = [
  {
    id: "a1",
    staffId: "s2",
    date: "2026-03-20",
    type: "研修",
    startTime: "13:00",
    endTime: "18:00",
    reason: "院内研修",
    emergency: false
  },
  {
    id: "a2",
    staffId: "s3",
    date: "2026-03-19",
    type: "欠勤",
    startTime: "09:00",
    endTime: "16:00",
    reason: "体調不良",
    emergency: true
  }
];

export const seedSchedules: Schedule[] = [
  {
    id: "sc1",
    clientId: "c1",
    staffId: "s1",
    scheduleDate: "2026-03-19",
    startTime: "09:00",
    endTime: "10:00",
    status: "confirmed",
    sourceType: "copied",
    warningCodes: []
  },
  {
    id: "sc2",
    clientId: "c2",
    staffId: "s2",
    scheduleDate: "2026-03-20",
    startTime: "10:00",
    endTime: "10:45",
    status: "draft",
    sourceType: "auto",
    warningCodes: ["absence_overlap"]
  }
];

export const seedChangeLogs: ChangeLog[] = [
  {
    id: "cl1",
    scheduleId: "sc2",
    changedBy: "管理者 田中",
    changeType: "auto_reassign",
    beforeJson: "{\"staffId\":\"s2\"}",
    afterJson: "{\"staffId\":\"s1\"}",
    reason: "欠勤候補確認",
    createdAt: "2026-03-18T09:30:00+09:00"
  }
];

export const seedNotifications: NotificationLog[] = [
  {
    id: "n1",
    scheduleId: "sc2",
    targetStaffId: "s2",
    channel: "email",
    sendStatus: "queued",
    messageBody: "3/20 10:00 伊藤 恒一様の予定が変更されました。"
  }
];
