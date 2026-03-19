"use client";

import { DragEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { exportJsonToCsv, exportJsonToExcel, parseSpreadsheet } from "@/lib/csv";
import { seedAbsences, seedChangeLogs, seedClients, seedNotifications, seedSchedules, seedSettings, seedStaffs, seedUsers } from "@/lib/mock-data";
import { addMinutes, generateSchedule, generateWeekDates, timeToMinutes } from "@/lib/scheduler";
import { ChangeLog, Client, NotificationLog, Role, Schedule, SchedulerMode, Staff, StaffAbsence, SystemSettings, User } from "@/lib/types";

type ViewKey = "dashboard" | "scheduler" | "clients" | "staff" | "absences" | "automation" | "notifications" | "history" | "help";
type DragTarget = { date: string; time: string } | null;
type ResizeState = { scheduleId: string; edge: "start" | "end"; startY: number; originalStartTime: string; originalEndTime: string } | null;

const weekdayLabels = ["月", "火", "水", "木", "金", "土", "日"];
const dayKeys = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const todayIso = () => "2026-03-18";
const makeId = (prefix: string) => `${prefix}-${Date.now()}`;
const SLOT_HEIGHT = 48;
const MINUTES_PER_SLOT = 30;
const RESIZE_STEP_MINUTES = 5;
const warningLabel = (warnings: string[]) => warnings.length ? warnings.join(" / ") : "なし";
const cardTone = (status: Schedule["status"]) => status === "confirmed" ? "border-sky-200 bg-sky-50" : "border-amber-200 bg-amber-50";
const dayColumnTone = (dayIndex: number) => dayIndex % 2 === 0 ? "bg-slate-50/70" : "bg-emerald-50/45";
const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);

const helpSections = [
  {
    title: "ログイン",
    image: "/help/login.svg",
    caption: "ログイン画面のイメージ",
    items: [
      "ログイン画面で ID とパスワードを入力してログインします。",
      "サンプルアカウント: admin / admin123、office / office123、viewer / viewer123"
    ]
  },
  {
    title: "データ取込",
    image: "/help/import.svg",
    caption: "利用者マスタと月間予定CSV取込のイメージ",
    items: [
      "利用者マスタまたはスタッフマスタから CSV/Excel 取込を実行できます。",
      "利用者・日付・開始時間・終了時間・職員名１ を含む CSV は月間予定として自動判定されます。",
      "取込時に未登録の利用者やスタッフはマスタへ自動補完されます。"
    ]
  },
  {
    title: "週次スケジュール",
    image: "/help/scheduler.svg",
    caption: "週次スケジュール画面のイメージ",
    items: [
      "左メニューの週指定で表示週を変更できます。",
      "予定カードはドラッグで別曜日・別時間・別スタッフ列へ移動できます。",
      "予定カードの上下端をドラッグすると 5 分単位で時間調整できます。",
      "短い予定はマウスオーバーで詳細ポップアップを表示できます。"
    ]
  },
  {
    title: "自動割当",
    image: "/help/autoassign.svg",
    caption: "自動割当と結果確認のイメージ",
    items: [
      "左メニューの 自動割当 で未割当予定へ担当候補を割り当てます。",
      "勤務時間外、休暇時間帯、重複予定、NG スタッフは自動割当されません。"
    ]
  },
  {
    title: "画面の見方",
    image: "/help/scheduler.svg",
    caption: "固定ヘッダーとスタッフ列の見え方",
    items: [
      "曜日ごとに背景色が少し変わります。",
      "日付・曜日・スタッフ名・時刻はスクロールしても固定表示されます。",
      "その日の予定がないスタッフ列は自動で非表示になります。",
      "スタッフ見出しには件数、合計分数、最初と最後の時刻が表示されます。"
    ]
  },
  {
    title: "出力と確認",
    image: "/help/autoassign.svg",
    caption: "結果確認と出力のイメージ",
    items: [
      "Excel出力 で表示中の週次予定を出力できます。",
      "通知 で送信状態を確認できます。",
      "履歴 で変更履歴を確認できます。"
    ]
  },
  {
    title: "困ったとき",
    image: "/help/import.svg",
    caption: "取込・表示確認のイメージ",
    items: [
      "自動割当されない場合は、勤務時間、休暇、重複、NG 設定を確認してください。",
      "取込後に見えない場合は、表示中の週と CSV の日付を確認してください。"
    ]
  }
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [users] = useState<User[]>(seedUsers);
  const [clients, setClients] = useState<Client[]>(seedClients);
  const [staffs, setStaffs] = useState<Staff[]>(seedStaffs);
  const [absences, setAbsences] = useState<StaffAbsence[]>(seedAbsences);
  const [schedules, setSchedules] = useState<Schedule[]>(seedSchedules);
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>(seedChangeLogs);
  const [notifications, setNotifications] = useState<NotificationLog[]>(seedNotifications);
  const [settings, setSettings] = useState<SystemSettings>(seedSettings);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginId, setLoginId] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [view, setView] = useState<ViewKey>("dashboard");
  const [anchorDate, setAnchorDate] = useState(todayIso());
  const [schedulerMode, setSchedulerMode] = useState<SchedulerMode>("new");
  const [resultSummary, setResultSummary] = useState("未実行");
  const [draggingScheduleId, setDraggingScheduleId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [resizeState, setResizeState] = useState<ResizeState>(null);
  const clientImportRef = useRef<HTMLInputElement>(null);
  const staffImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const weekDates = useMemo(() => generateWeekDates(anchorDate), [anchorDate]);
  const scheduleRows = useMemo(() => Array.from({ length: 20 }, (_, index) => {
    const totalMinutes = 8 * 60 + index * 30;
    const hour = Math.floor(totalMinutes / 60);
    const minutes = `${totalMinutes % 60}`.padStart(2, "0");
    return `${`${hour}`.padStart(2, "0")}:${minutes}`;
  }), []);
  const daySchedules = useMemo(() => schedules.filter((s) => weekDates.includes(s.scheduleDate)), [schedules, weekDates]);
  const canEdit = currentUser?.role !== "viewer";
  const staffColumnsByDate = useMemo(() => {
    const activeStaffs = staffs.filter((staff) => staff.isActive);
    return Object.fromEntries(
      weekDates.map((date) => {
        const scheduledStaffIds = new Set(
          daySchedules
            .filter((schedule) => schedule.scheduleDate === date)
            .map((schedule) => schedule.staffId)
            .filter(Boolean)
        );
        const filtered = activeStaffs.filter((staff) => scheduledStaffIds.has(staff.id));
        return [date, filtered.length > 0 ? filtered : activeStaffs];
      })
    ) as Record<string, Staff[]>;
  }, [daySchedules, staffs, weekDates]);
  const totalVisibleStaffColumns = useMemo(
    () => weekDates.reduce((sum, date) => sum + (staffColumnsByDate[date]?.length ?? 0), 0),
    [staffColumnsByDate, weekDates]
  );

  const dashboard = useMemo(() => ({
    todayCount: schedules.filter((s) => s.scheduleDate === todayIso()).length,
    unassignedCount: schedules.filter((s) => !s.staffId).length,
    changeCount: changeLogs.length,
    absenceCount: absences.length,
    unsentCount: notifications.filter((n) => n.sendStatus !== "sent").length
  }), [schedules, changeLogs, absences, notifications]);

  const getStaffDaySummary = (date: string, staffId: string) => {
    const staffSchedules = daySchedules
      .filter((schedule) => schedule.scheduleDate === date && schedule.staffId === staffId)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    const visitCount = staffSchedules.length;
    const totalMinutes = staffSchedules.reduce((sum, schedule) => sum + (timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime)), 0);
    return {
      visitCount,
      totalMinutes,
      firstTime: staffSchedules[0]?.startTime,
      lastTime: staffSchedules[staffSchedules.length - 1]?.endTime
    };
  };

  const nav: { key: ViewKey; label: string; roles: Role[] }[] = [
    { key: "dashboard", label: "ダッシュボード", roles: ["admin", "office", "viewer"] },
    { key: "scheduler", label: "週次スケジュール", roles: ["admin", "office", "viewer"] },
    { key: "clients", label: "利用者マスタ", roles: ["admin", "office"] },
    { key: "staff", label: "スタッフマスタ", roles: ["admin", "office"] },
    { key: "absences", label: "休暇管理", roles: ["admin", "office"] },
    { key: "automation", label: "自動割当", roles: ["admin", "office"] },
    { key: "notifications", label: "通知", roles: ["admin", "office"] },
    { key: "history", label: "履歴", roles: ["admin", "office", "viewer"] },
    { key: "help", label: "HELP", roles: ["admin", "office", "viewer"] }
  ];

  const handleLogin = () => {
    const found = users.find((u) => u.loginId === loginId && u.password === password);
    if (found) setCurrentUser(found);
  };

  const logChange = (scheduleId: string, changeType: string, beforeJson: string, afterJson: string, reason: string) => {
    setChangeLogs((prev) => [{ id: makeId("log"), scheduleId, changedBy: currentUser?.name ?? "system", changeType, beforeJson, afterJson, reason, createdAt: new Date().toISOString() }, ...prev]);
  };

  const queueNotification = (scheduleId: string, targetStaffId: string, messageBody: string) => {
    setNotifications((prev) => [{ id: makeId("nt"), scheduleId, targetStaffId, channel: "email", sendStatus: "queued", messageBody }, ...prev]);
  };

  const validateMove = (
    schedule: Schedule,
    newDate: string,
    newStartTime: string,
    newEndTime?: string,
    nextStaffId?: string
  ) => {
    const effectiveStaffId = nextStaffId ?? schedule.staffId;
    if (!effectiveStaffId) return { ok: true, warnings: [] as string[] };
    const staff = staffs.find((item) => item.id === effectiveStaffId);
    if (!staff) return { ok: false, reason: "スタッフ情報が見つかりません。" };
    const duration = newEndTime ? timeToMinutes(newEndTime) - timeToMinutes(newStartTime) : timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime);
    const finalEndTime = newEndTime ?? addMinutes(newStartTime, duration);
    const warnings: string[] = [];
    if (timeToMinutes(newStartTime) < timeToMinutes(staff.workStartTime) || timeToMinutes(finalEndTime) > timeToMinutes(staff.workEndTime)) return { ok: false, reason: "勤務時間外には設定できません。" };
    const weekday = (new Date(newDate).getDay() + 6) % 7;
    if (!staff.workDays.includes(weekday)) return { ok: false, reason: "その曜日は勤務対象外です。" };
    const blockedByAbsence = absences.some((absence) => absence.staffId === staff.id && absence.date === newDate && overlaps(newStartTime, finalEndTime, absence.startTime, absence.endTime));
    if (blockedByAbsence) return { ok: false, reason: "休暇・対応不可時間帯には設定できません。" };
    const hasConflict = schedules.some((item) => item.id !== schedule.id && item.staffId === effectiveStaffId && item.scheduleDate === newDate && overlaps(newStartTime, finalEndTime, item.startTime, item.endTime));
    if (hasConflict) return { ok: false, reason: "同じスタッフの予定と重複します。" };
    const visitsThatDay = schedules.filter((item) => item.id !== schedule.id && item.staffId === effectiveStaffId && item.scheduleDate === newDate).length + 1;
    if (visitsThatDay > staff.maxVisitPerDay) warnings.push("1日上限件数に近い状態です");
    return { ok: true, warnings };
  };

  const runAutoAssign = () => {
    const result = generateSchedule({ clients, staffs, absences, currentSchedules: schedules, settings, anchorDate, mode: schedulerMode });
    const mergedMap = new Map<string, Schedule>();
    [...result.schedules, ...result.unassigned].forEach((schedule) => mergedMap.set(schedule.id, schedule));
    const merged = Array.from(mergedMap.values()).sort((a, b) => `${a.scheduleDate}${a.startTime}${a.id}`.localeCompare(`${b.scheduleDate}${b.startTime}${b.id}`));
    setSchedules(merged);
    setResultSummary(`割当 ${result.schedules.filter((schedule) => !!schedule.staffId).length}件 / 未割当 ${result.unassigned.length}件 / 競合 ${result.conflicts.length}件`);
  };

  const cycleStaff = (scheduleId: string) => {
    const target = schedules.find((s) => s.id === scheduleId);
    if (!target) return;
    const client = clients.find((c) => c.id === target.clientId);
    const candidates = staffs.filter((staff) => !client || !client.ngStaffIds.includes(staff.id));
    const idx = Math.max(0, candidates.findIndex((c) => c.id === target.staffId));
    const next = candidates[(idx + 1) % candidates.length];
    setSchedules((prev) => prev.map((s) => s.id === scheduleId ? { ...s, staffId: next?.id, status: "draft", sourceType: "manual" } : s));
    logChange(scheduleId, "manual_assign", JSON.stringify(target), JSON.stringify({ ...target, staffId: next?.id }), "手動変更");
    if (next) queueNotification(scheduleId, next.id, `${target.scheduleDate} ${target.startTime} の担当変更`);
  };

  const moveSchedule = (scheduleId: string, newDate: string, newStartTime: string, nextStaffId?: string) => {
    const target = schedules.find((s) => s.id === scheduleId);
    if (!target) return;
    const validation = validateMove(target, newDate, newStartTime, undefined, nextStaffId);
    if (!validation.ok) {
      setResultSummary(validation.reason ?? "移動できません。");
      return;
    }
    const duration = timeToMinutes(target.endTime) - timeToMinutes(target.startTime);
    const updatedWarnings = [...target.warningCodes.filter((item) => item !== "manual_adjustment_needed"), ...(validation.warnings ?? [])];
    const updated: Schedule = { ...target, staffId: nextStaffId ?? target.staffId, scheduleDate: newDate, startTime: newStartTime, endTime: addMinutes(newStartTime, duration), status: "draft", sourceType: "manual", warningCodes: updatedWarnings };
    setSchedules((prev) => prev.map((s) => s.id === scheduleId ? updated : s));
    logChange(scheduleId, "drag_move", JSON.stringify(target), JSON.stringify(updated), "ドラッグで移動");
    if (updated.staffId) queueNotification(scheduleId, updated.staffId, `${newDate} ${newStartTime} に予定が移動しました。`);
    setResultSummary(validation.warnings?.length ? `移動しました: ${validation.warnings.join(" / ")}` : "移動しました");
  };

  const resizeSchedule = (scheduleId: string, nextTimes: { startTime?: string; endTime?: string }) => {
    const target = schedules.find((s) => s.id === scheduleId);
    if (!target) return;
    const newStartTime = nextTimes.startTime ?? target.startTime;
    const newEndTime = nextTimes.endTime ?? target.endTime;
    if (timeToMinutes(newEndTime) <= timeToMinutes(newStartTime)) {
      setResultSummary("開始時刻と終了時刻の前後関係が不正です。");
      return;
    }
    const validation = validateMove(target, target.scheduleDate, newStartTime, newEndTime);
    if (!validation.ok) {
      setResultSummary(validation.reason ?? "時間変更できません。");
      return;
    }
    const updated: Schedule = { ...target, startTime: newStartTime, endTime: newEndTime, status: "draft", sourceType: "manual", warningCodes: [...target.warningCodes.filter((item) => item !== "manual_adjustment_needed"), ...(validation.warnings ?? [])] };
    setSchedules((prev) => prev.map((s) => s.id === scheduleId ? updated : s));
    logChange(scheduleId, "resize", JSON.stringify(target), JSON.stringify(updated), "マウスで時間調整");
    if (updated.staffId) queueNotification(scheduleId, updated.staffId, `${target.scheduleDate} の時間帯が ${newStartTime}-${newEndTime} に変更されました。`);
    setResultSummary(validation.warnings?.length ? `時間変更しました: ${validation.warnings.join(" / ")}` : "時間変更しました");
  };


  const confirmSchedule = (scheduleId: string) => {
    const before = schedules.find((s) => s.id === scheduleId);
    if (!before) return;
    setSchedules((prev) => prev.map((s) => s.id === scheduleId ? { ...s, status: "confirmed" } : s));
    logChange(scheduleId, "confirm", JSON.stringify(before), JSON.stringify({ ...before, status: "confirmed" }), "確定");
  };
  const addClient = () => setClients((prev) => [{ ...seedClients[0], id: makeId("c"), clientCode: `NEW${prev.length + 1}`, name: `新規利用者 ${prev.length + 1}`, carryOverFromPreviousMonth: false }, ...prev]);
  const addStaff = () => setStaffs((prev) => [...prev, { ...seedStaffs[0], id: makeId("s"), staffCode: `NEW${prev.length + 1}`, name: `追加スタッフ ${prev.length + 1}` }]);
  const addAbsence = (staffId: string) => setAbsences((prev) => [{ id: makeId("a"), staffId, date: anchorDate, type: "欠勤", startTime: "09:00", endTime: "18:00", reason: "当日登録", emergency: true }, ...prev]);
  const normalizeText = (value: string | number | boolean | undefined) => String(value ?? "").trim();
  const parseMonthFromFileName = (fileName: string) => {
    const match = fileName.match(/(20\d{2})[^\d]?(\d{2})/);
    if (match) return { year: Number(match[1]), month: Number(match[2]) };
    const baseDate = new Date(anchorDate);
    return { year: baseDate.getFullYear(), month: baseDate.getMonth() + 1 };
  };
  const toIsoDate = (dayValue: string | number | boolean | undefined, fileName: string) => {
    const day = Number(normalizeText(dayValue));
    if (!Number.isFinite(day) || day <= 0) return "";
    const { year, month } = parseMonthFromFileName(fileName);
    return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
  };
  const isVisitScheduleRow = (row: Record<string, string | number | boolean>) =>
    ["利用者", "開始時間", "終了時間", "日付"].every((key) => key in row);
  const uniqueById = <T extends { id: string }>(rows: T[]) => Array.from(new Map(rows.map((row) => [row.id, row])).values());
  const parseWeekdays = (value: string) => {
    const source = value || "月";
    const map: Record<string, number> = { "月": 0, "火": 1, "水": 2, "木": 3, "金": 4, "土": 5, "日": 6 };
    return source
      .split(/[\/,、\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => map[item])
      .filter((item) => item !== undefined);
  };

  const pickInitialStaffId = (client: Client) => {
    const direct = client.priorityStaffId ?? client.candidateStaffIds[0];
    if (direct) return direct;
    const areaMatch = staffs.find((staff) => staff.serviceAreas.includes(client.area) && staff.isActive);
    return areaMatch?.id ?? staffs.find((staff) => staff.isActive)?.id;
  };

  const buildImportedSchedules = (client: Client) => {
    const staffId = pickInitialStaffId(client);
    return weekDates
      .filter((date) => client.defaultWeekdays.includes((new Date(date).getDay() + 6) % 7))
      .slice(0, client.frequencyPerWeek)
      .map((date, index) => ({
        id: `${makeId("import-schedule")}-${index}`,
        clientId: client.id,
        staffId,
        scheduleDate: date,
        startTime: client.preferredTimeWindow.start,
        endTime: addMinutes(client.preferredTimeWindow.start, client.defaultDurationMinutes),
        status: "draft" as const,
        sourceType: "manual" as const,
        warningCodes: staffId ? [] : ["unassigned"]
      }));
  };


  const handleImport = async (file: File, target: "clients" | "staffs") => {
    const rows = await parseSpreadsheet(file);
    if (target === "clients") {
      if (rows.length > 0 && isVisitScheduleRow(rows[0])) {
        const existingClientByName = new Map(clients.map((client) => [client.name, client]));
        const existingStaffByName = new Map(staffs.map((staff) => [staff.name, staff]));
        const importedClients: Client[] = [];
        const importedStaffs: Staff[] = [];
        const importedSchedules: Schedule[] = [];
        const clientWeekdays = new Map<string, Set<number>>();
        const clientVisitCounts = new Map<string, number>();

        rows.forEach((row, index) => {
          const clientName = normalizeText(row["利用者"] || row.name);
          const primaryStaffName = normalizeText(row["職員名１"] || row["担当者"] || row.staffName);
          const startTime = normalizeText(row["開始時間"] || row.startTime);
          const endTime = normalizeText(row["終了時間"] || row.endTime);
          const scheduleDate = toIsoDate(row["日付"] || row.date, file.name);
          if (!clientName || !startTime || !endTime || !scheduleDate) return;

          const weekday = (new Date(scheduleDate).getDay() + 6) % 7;
          if (!clientWeekdays.has(clientName)) clientWeekdays.set(clientName, new Set<number>());
          clientWeekdays.get(clientName)?.add(weekday);
          clientVisitCounts.set(clientName, (clientVisitCounts.get(clientName) ?? 0) + 1);

          let client = existingClientByName.get(clientName);
          if (!client) {
            client = {
              ...seedClients[0],
              id: `${makeId("csv-client")}-${index}`,
              clientCode: `CSV${clients.length + importedClients.length + 1}`,
              name: clientName,
              area: normalizeText(row["事業所名"] || row.area) || seedClients[0].area,
              defaultWeekdays: [weekday],
              preferredTimeWindow: { start: startTime, end: endTime },
              defaultDurationMinutes: Math.max(5, timeToMinutes(endTime) - timeToMinutes(startTime)),
              frequencyPerWeek: 1,
              notes: normalizeText(row["サービス内容"]),
              careNotes: normalizeText(row["備考"]),
              carryOverFromPreviousMonth: true
            };
            importedClients.push(client);
            existingClientByName.set(clientName, client);
          } else {
            client = {
              ...client,
              area: normalizeText(row["事業所名"] || row.area) || client.area,
              preferredTimeWindow: { start: startTime || client.preferredTimeWindow.start, end: endTime || client.preferredTimeWindow.end },
              defaultDurationMinutes: Math.max(5, timeToMinutes(endTime) - timeToMinutes(startTime)),
              notes: normalizeText(row["サービス内容"]) || client.notes,
              careNotes: normalizeText(row["備考"]) || client.careNotes,
              carryOverFromPreviousMonth: true
            };
            existingClientByName.set(clientName, client);
          }

          let staff = primaryStaffName ? existingStaffByName.get(primaryStaffName) : undefined;
          if (primaryStaffName && !staff) {
            staff = {
              ...seedStaffs[0],
              id: `${makeId("csv-staff")}-${index}`,
              staffCode: `CSV${staffs.length + importedStaffs.length + 1}`,
              name: primaryStaffName,
              position: normalizeText(row["職種１"]) || seedStaffs[0].position,
              isActive: true
            };
            importedStaffs.push(staff);
            existingStaffByName.set(primaryStaffName, staff);
          } else if (staff) {
            staff = {
              ...staff,
              position: normalizeText(row["職種１"]) || staff.position,
              isActive: true
            };
            existingStaffByName.set(primaryStaffName, staff);
          }

          importedSchedules.push({
            id: `imported-${scheduleDate}-${startTime}-${client.id}-${staff?.id ?? "unassigned"}`,
            clientId: client.id,
            staffId: staff?.id,
            scheduleDate,
            startTime,
            endTime,
            status: "draft",
            sourceType: "manual",
            note: normalizeText(row["備考"] || row["サービス内容"]),
            warningCodes: staff ? [] : ["unassigned"]
          });
        });

        setClients((prev) => {
          const merged = prev.map((client) => {
            const updated = existingClientByName.get(client.name);
            if (!updated) return client;
            const weekdays = Array.from(clientWeekdays.get(client.name) ?? new Set(client.defaultWeekdays));
            return {
              ...client,
              ...updated,
              defaultWeekdays: weekdays.length > 0 ? weekdays.sort((a, b) => a - b) : client.defaultWeekdays,
              frequencyPerWeek: Math.max(client.frequencyPerWeek, Math.min(weekdays.length || 1, clientVisitCounts.get(client.name) ?? client.frequencyPerWeek))
            };
          });
          const existingNames = new Set(prev.map((client) => client.name));
          const additions = importedClients.map((client) => ({
            ...client,
            defaultWeekdays: Array.from(clientWeekdays.get(client.name) ?? new Set(client.defaultWeekdays)).sort((a, b) => a - b),
            frequencyPerWeek: Math.max(1, Math.min((clientWeekdays.get(client.name) ?? new Set()).size || 1, clientVisitCounts.get(client.name) ?? 1))
          })).filter((client) => !existingNames.has(client.name));
          return [...merged, ...additions];
        });

        setStaffs((prev) => {
          const merged = prev.map((staff) => {
            const updated = existingStaffByName.get(staff.name);
            return updated ? { ...staff, ...updated } : staff;
          });
          const existingNames = new Set(prev.map((staff) => staff.name));
          const additions = importedStaffs.filter((staff) => !existingNames.has(staff.name));
          return [...merged, ...additions];
        });

        setSchedules((prev) => {
          const existingKeys = new Set(prev.map((schedule) => `${schedule.scheduleDate}|${schedule.startTime}|${schedule.endTime}|${schedule.clientId}|${schedule.staffId ?? ""}`));
          const nextSchedules = importedSchedules.filter((schedule) => !existingKeys.has(`${schedule.scheduleDate}|${schedule.startTime}|${schedule.endTime}|${schedule.clientId}|${schedule.staffId ?? ""}`));
          return uniqueById([...prev, ...nextSchedules]);
        });
        setResultSummary(`${importedSchedules.length}件の月間予定を取込し、利用者マスタ ${importedClients.length}件・スタッフマスタ ${importedStaffs.length}件を更新しました。`);
        return;
      }

      const importedClients = rows.map((row, i) => {
        const weekdays = parseWeekdays(String(row.defaultWeekdays || row.weekdays || row.weekday || "月"));
        const startTime = String(row.startTime || row.preferredStartTime || row.time || "09:00");
        const duration = Number(row.duration || row.durationMinutes || 60);
        const client: Client = {
          ...seedClients[0],
          id: `${makeId("ic")}-${i}`,
          clientCode: String(row.clientCode || `IMP${i}`),
          name: String(row.name || "取込利用者"),
          area: String(row.area || seedClients[0].area),
          defaultWeekdays: weekdays.length > 0 ? weekdays : [0],
          preferredTimeWindow: { start: startTime, end: addMinutes(startTime, duration) },
          defaultDurationMinutes: duration,
          frequencyPerWeek: Number(row.frequencyPerWeek || row.frequency || weekdays.length || 1),
          candidateStaffIds: [],
          priorityStaffId: undefined
        };
        return client;
      });
      setClients((prev) => {
        const merged = [...prev];
        importedClients.forEach((client) => {
          const index = merged.findIndex((item) => item.clientCode === client.clientCode || item.name === client.name);
          if (index >= 0) merged[index] = { ...merged[index], ...client };
          else merged.push(client);
        });
        return merged;
      });
      setSchedules((prev) => [...prev, ...importedClients.flatMap((client) => buildImportedSchedules(client))]);
      setResultSummary(`${importedClients.length}件の利用者を取込し、マスタと今週の予定へ反映しました。`);
    }
    if (target === "staffs") {
      const importedStaffs = rows.map((row, i) => ({ ...seedStaffs[0], id: `${makeId("is")}-${i}`, staffCode: String(row.staffCode || `IMP${i}`), name: String(row.name || "取込スタッフ") }));
      setStaffs((prev) => {
        const merged = [...prev];
        importedStaffs.forEach((staff) => {
          const index = merged.findIndex((item) => item.staffCode === staff.staffCode || item.name === staff.name);
          if (index >= 0) merged[index] = { ...merged[index], ...staff };
          else merged.push(staff);
        });
        return merged;
      });
      setResultSummary(`${rows.length}件のスタッフを取込しました。`);
    }
  };

  const handleScheduleDragStart = (event: DragEvent<HTMLDivElement>, scheduleId: string) => {
    if (!canEdit || resizeState) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", scheduleId);
    setDraggingScheduleId(scheduleId);
  };

  const handleGridDrop = (event: DragEvent<HTMLDivElement>, date: string, time: string, staffId?: string) => {
    event.preventDefault();
    const scheduleId = event.dataTransfer.getData("text/plain") || draggingScheduleId;
    if (scheduleId) moveSchedule(scheduleId, date, time, staffId);
    setDraggingScheduleId(null);
    setDragTarget(null);
  };

  useEffect(() => {
    if (!resizeState) return;
    const onMove = (event: globalThis.MouseEvent) => {
      const schedule = schedules.find((item) => item.id === resizeState.scheduleId);
      if (!schedule) return;
      const deltaY = event.clientY - resizeState.startY;
      const deltaMinutes = Math.round((deltaY / SLOT_HEIGHT) * MINUTES_PER_SLOT / RESIZE_STEP_MINUTES) * RESIZE_STEP_MINUTES;
      if (resizeState.edge === "end") {
        const originalEnd = timeToMinutes(resizeState.originalEndTime);
        const minEnd = timeToMinutes(schedule.startTime) + RESIZE_STEP_MINUTES;
        const snappedEnd = Math.max(minEnd, originalEnd + deltaMinutes);
        const hours = `${Math.floor(snappedEnd / 60)}`.padStart(2, "0");
        const minutes = `${snappedEnd % 60}`.padStart(2, "0");
        resizeSchedule(schedule.id, { endTime: `${hours}:${minutes}` });
      } else {
        const originalStart = timeToMinutes(resizeState.originalStartTime);
        const maxStart = timeToMinutes(schedule.endTime) - RESIZE_STEP_MINUTES;
        const snappedStart = Math.min(maxStart, originalStart + deltaMinutes);
        const hours = `${Math.floor(snappedStart / 60)}`.padStart(2, "0");
        const minutes = `${snappedStart % 60}`.padStart(2, "0");
        resizeSchedule(schedule.id, { startTime: `${hours}:${minutes}` });
      }
    };
    const onUp = () => setResizeState(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizeState, schedules]);

  if (!mounted) return <main className="min-h-screen bg-transparent" />;
  if (!currentUser) return <main className="flex min-h-screen items-center justify-center p-6"><section className="panel grid w-full max-w-4xl gap-0 lg:grid-cols-2"><div className="bg-ink px-8 py-10 text-white"><p className="text-sm uppercase tracking-[0.25em] text-emerald-200">Neo Vision</p><h1 className="mt-4 text-4xl font-bold leading-tight">訪問看護向け<br />自動スケジュール最適化ツール</h1><p className="mt-4 text-sm leading-7 text-slate-200">Excel に近い週次表で、前月参照生成・欠勤再割当・通知・履歴をまとめて扱う MVP です。</p></div><div className="px-8 py-10"><h2 className="text-2xl font-bold">ログイン</h2><div className="mt-8 space-y-4"><input className="field" value={loginId} onChange={(e) => setLoginId(e.target.value)} /><input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /><button className="btn-primary w-full" onClick={handleLogin}>ログイン</button></div><div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600"><p>admin / admin123</p><p>office / office123</p><p>viewer / viewer123</p></div></div></section></main>;

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto grid max-w-[1500px] gap-4 xl:grid-cols-[240px_1fr]">
        <aside className="panel p-4">
          <div className="rounded-3xl bg-ink p-5 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">Operations</p>
            <h1 className="mt-2 text-2xl font-bold">訪問看護スケジューラー</h1>
            <p className="mt-3 text-sm">{currentUser.name}</p>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Weekly Control</p>
            <p className="mt-2 text-lg font-bold text-slate-800">{anchorDate} を含む週</p>
            <input className="field mt-3" type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
            <div className="mt-3 grid gap-2">
              <button className="btn-primary w-full" onClick={runAutoAssign}>自動割当</button>
              <button className="btn-secondary w-full" onClick={() => exportJsonToExcel(daySchedules as unknown as Record<string, unknown>[], "weekly-schedule.xlsx")}>Excel出力</button>
            </div>
          </div>
          <nav className="mt-4 space-y-2">{nav.filter((n) => n.roles.includes(currentUser.role)).map((n) => <button key={n.key} className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold ${view === n.key ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-700"}`} onClick={() => setView(n.key)}>{n.label}</button>)}</nav>
          <button className="btn-secondary mt-4 w-full" onClick={() => setCurrentUser(null)}>ログアウト</button>
        </aside>
        <section className="space-y-4">
          {view === "dashboard" && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{[["本日の訪問件数", dashboard.todayCount],["未割当", dashboard.unassignedCount],["変更履歴", dashboard.changeCount],["欠勤情報", dashboard.absenceCount],["未送信通知", dashboard.unsentCount]].map(([label, value]) => <div key={String(label)} className="panel p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold">{String(value)}</p></div>)}</div>}
          {view === "scheduler" && (
            <div className="panel overflow-hidden">
              <div className="border-b border-slate-100 p-4 text-sm text-slate-500">おすすめ表示: 曜日ごとにスタッフ列を分けています。同時刻に複数訪問があっても横に並ぶので、訪問看護の運用で追いやすい形です。</div>
              <div className="max-h-[82vh] overflow-auto">
                <div className="min-w-[1180px]">
                  <div
                    className="grid"
                    style={{ gridTemplateColumns: `120px repeat(${totalVisibleStaffColumns}, minmax(84px, 1fr))` }}
                  >
                    <div className="sticky left-0 top-0 z-40 border-b border-r border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-semibold shadow-sm">Time</div>
                    {weekDates.map((date, dayIndex) => {
                      const staffsForDate = staffColumnsByDate[date] ?? [];
                      return (
                        <div
                          key={date}
                          className={`sticky top-0 z-30 border-b border-r border-slate-200 px-1 py-1 shadow-sm ${dayColumnTone(dayIndex)}`}
                          style={{ gridColumn: `span ${staffsForDate.length}` }}
                        >
                          <p className="text-xs text-slate-500">{dayKeys[dayIndex]}</p>
                          <p className="font-bold">{weekdayLabels[dayIndex]} {date.slice(5)}</p>
                        </div>
                      );
                    })}

                    <div className="sticky left-0 top-[43px] z-40 border-b border-r border-slate-100 bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-500 shadow-sm">担当</div>
                    {weekDates.flatMap((date, dayIndex) =>
                      (staffColumnsByDate[date] ?? []).map((staff) => {
                        const summary = getStaffDaySummary(date, staff.id);
                        return (
                          <div
                            key={`${date}-${staff.id}-header`}
                            className={`sticky top-[43px] z-30 border-b border-r border-slate-100 px-1 py-1 text-slate-600 shadow-sm ${dayColumnTone(dayIndex)}`}
                          >
                            <p className="truncate text-[9px] font-semibold">{staff.name}</p>
                            <p className="mt-0.5 text-[8px] leading-tight text-slate-500">{summary.visitCount}件 / {summary.totalMinutes}分</p>
                            <p className="text-[8px] leading-tight text-slate-400">{summary.firstTime && summary.lastTime ? `${summary.firstTime}-${summary.lastTime}` : "予定なし"}</p>
                          </div>
                        );
                      })
                    )}

                    {scheduleRows.map((time) => (
                      <div key={time} className="contents">
                        <div className="sticky left-0 z-20 border-b border-r border-slate-200 bg-white px-1.5 py-1 text-[11px] font-semibold text-slate-500">{time}</div>
                        {weekDates.flatMap((date, dayIndex) =>
                          (staffColumnsByDate[date] ?? []).map((staff) => {
                            const rowStart = timeToMinutes(time);
                            const rowEnd = rowStart + MINUTES_PER_SLOT;
                            const cellSchedules = daySchedules.filter(
                              (schedule) =>
                                schedule.scheduleDate === date &&
                                schedule.staffId === staff.id &&
                                timeToMinutes(schedule.startTime) >= rowStart &&
                                timeToMinutes(schedule.startTime) < rowEnd
                            );
                            const highlighted = dragTarget?.date === date && dragTarget?.time === time;
                            return (
                              <div
                                key={`${date}-${staff.id}-${time}`}
                                className={`relative h-12 overflow-visible border-b border-r border-slate-200 transition ${highlighted ? "bg-emerald-100" : dayColumnTone(dayIndex)}`}
                                onDragOver={(e) => {
                                  if (canEdit && !resizeState) {
                                    e.preventDefault();
                                    setDragTarget({ date, time });
                                  }
                                }}
                                onDragLeave={() =>
                                  setDragTarget((current) =>
                                    current?.date === date && current?.time === time ? null : current
                                  )
                                }
                                onDrop={(e) => handleGridDrop(e, date, time, staff.id)}
                              >
                                {cellSchedules.map((schedule) => {
                                  const client = clients.find((client) => client.id === schedule.clientId);
                                  const durationMinutes = timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime);
                                  const offsetWithinCell = ((timeToMinutes(schedule.startTime) - rowStart) / MINUTES_PER_SLOT) * SLOT_HEIGHT;
                                  const height = Math.max((durationMinutes / MINUTES_PER_SLOT) * SLOT_HEIGHT - 2, 42);
                                  const compactCard = height < 58;
                                  return (
                                    <div
                                      key={schedule.id}
                                      draggable={canEdit && !resizeState}
                                      onDragStart={(e) => handleScheduleDragStart(e, schedule.id)}
                                      onDragEnd={() => {
                                        setDraggingScheduleId(null);
                                        setDragTarget(null);
                                      }}
                                      className={`group absolute inset-x-0 z-10 overflow-visible rounded-lg border px-1.5 py-1 text-left shadow-sm hover:z-[80] ${cardTone(schedule.status)} ${draggingScheduleId === schedule.id ? "opacity-50" : ""}`}
                                      style={{ top: `${offsetWithinCell}px`, height: `${height}px` }}
                                    >
                                      <div className="overflow-hidden rounded-md">
                                        <p className="truncate text-[11px] font-semibold leading-snug">{client?.name ?? "未設定"}</p>
                                        <p className="mt-0.5 text-[10px] leading-tight">{schedule.startTime}-{schedule.endTime}</p>
                                        {!compactCard && (
                                          <div className="mt-0.5 flex items-center justify-between gap-1">
                                            <p className="truncate text-[9px] leading-tight">{staff.name}</p>
                                            {canEdit && height >= 68 && (
                                              <button
                                                className="btn-secondary invisible inline-flex h-3.5 w-3.5 items-center justify-center rounded-full p-0 text-[8px] leading-none opacity-0 transition group-hover:visible group-hover:opacity-100"
                                                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                                                  event.stopPropagation();
                                                  cycleStaff(schedule.id);
                                                }}
                                                aria-label="担当変更"
                                                title="担当変更"
                                              >
                                                &#9998;
                                              </button>
                                            )}
                                          </div>
                                        )}
                                        {!compactCard && height >= 50 && <p className="mt-0.5 truncate text-[8px] leading-tight text-rose-700">{warningLabel(schedule.warningCodes)}</p>}
                                      </div>
                                      <div className="pointer-events-none invisible absolute left-0 top-full z-[90] mt-1 w-[180px] rounded-xl border border-slate-200 bg-white p-2 text-[11px] text-slate-700 shadow-2xl opacity-0 transition group-hover:visible group-hover:opacity-100">
                                        <p className="font-semibold text-slate-900">{client?.name ?? "未設定"}</p>
                                        <p className="mt-1">{schedule.scheduleDate} {schedule.startTime}-{schedule.endTime}</p>
                                        <p className="mt-1">担当: {staff.name}</p>
                                        <p className="mt-1">状態: {schedule.status === "confirmed" ? "確定" : "仮"}</p>
                                        <p className="mt-1 text-rose-700">警告: {warningLabel(schedule.warningCodes)}</p>
                                      </div>
                                      {canEdit && (
                                        <div
                                          className="absolute inset-x-1 top-0 h-2 cursor-ns-resize rounded-t-lg bg-slate-300/70"
                                          onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
                                            event.stopPropagation();
                                            event.preventDefault();
                                            setResizeState({
                                              scheduleId: schedule.id,
                                              edge: "start",
                                              startY: event.clientY,
                                              originalStartTime: schedule.startTime,
                                              originalEndTime: schedule.endTime
                                            });
                                          }}
                                        />
                                      )}
                                      {canEdit && (
                                        <div
                                          className="absolute inset-x-1 bottom-0 h-2 cursor-ns-resize rounded-b-lg bg-slate-300/70"
                                          onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
                                            event.stopPropagation();
                                            event.preventDefault();
                                            setResizeState({
                                              scheduleId: schedule.id,
                                              edge: "end",
                                              startY: event.clientY,
                                              originalStartTime: schedule.startTime,
                                              originalEndTime: schedule.endTime
                                            });
                                          }}
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {view === "clients" && <div className="space-y-4"><div className="panel flex flex-wrap items-center justify-between gap-2 p-4"><h3 className="text-lg font-bold">利用者マスタ</h3><div className="flex gap-2"><button className="btn-primary" onClick={addClient}>新規登録</button><button className="btn-secondary" onClick={() => clientImportRef.current?.click()}>CSV/Excel取込</button><button className="btn-secondary" onClick={() => exportJsonToCsv(clients as unknown as Record<string, unknown>[], "clients.csv")}>CSV出力</button><input ref={clientImportRef} className="hidden" type="file" accept=".csv,.xlsx" onChange={async (e) => { const file = e.target.files?.[0]; if (file) await handleImport(file, "clients"); }} /></div></div><div className="grid gap-4 xl:grid-cols-2">{clients.map((c) => <div key={c.id} className="panel p-5"><p className="text-xs text-slate-500">{c.clientCode}</p><h4 className="mt-1 text-lg font-bold">{c.name}</h4><p className="mt-3 text-sm">エリア: {c.area}</p><p className="text-sm">訪問曜日: {c.defaultWeekdays.map((d) => weekdayLabels[d]).join(" / ")}</p><p className="text-sm">頻度: 週{c.frequencyPerWeek}回</p><p className="text-sm">注意事項: {c.careNotes || "なし"}</p></div>)}</div></div>}
          {view === "staff" && <div className="space-y-4"><div className="panel flex flex-wrap items-center justify-between gap-2 p-4"><h3 className="text-lg font-bold">スタッフマスタ</h3><div className="flex gap-2"><button className="btn-primary" onClick={addStaff}>新規登録</button><button className="btn-secondary" onClick={() => staffImportRef.current?.click()}>CSV/Excel取込</button><button className="btn-secondary" onClick={() => exportJsonToExcel(staffs as unknown as Record<string, unknown>[], "staffs.xlsx")}>Excel出力</button><input ref={staffImportRef} className="hidden" type="file" accept=".csv,.xlsx" onChange={async (e) => { const file = e.target.files?.[0]; if (file) await handleImport(file, "staffs"); }} /></div></div><div className="grid gap-4 xl:grid-cols-2">{staffs.map((s) => <div key={s.id} className="panel p-5"><p className="text-xs text-slate-500">{s.staffCode}</p><h4 className="mt-1 text-lg font-bold">{s.name}</h4><p className="mt-3 text-sm">勤務: {s.workStartTime}-{s.workEndTime}</p><p className="text-sm">対応エリア: {s.serviceAreas.join(" / ")}</p><button className="btn-secondary mt-4" onClick={() => addAbsence(s.id)}>欠勤登録</button></div>)}</div></div>}
          {view === "absences" && <div className="grid gap-4 xl:grid-cols-2">{absences.map((a) => { const staff = staffs.find((s) => s.id === a.staffId); const impacted = schedules.filter((s) => s.staffId === a.staffId && s.scheduleDate === a.date); return <div key={a.id} className="panel p-5"><h4 className="text-lg font-bold">{staff?.name}</h4><p className="mt-2 text-sm">{a.date} {a.startTime}-{a.endTime}</p><p className="text-sm">理由: {a.reason}</p><p className="text-sm">影響予定: {impacted.length}件</p><button className="btn-primary mt-4" onClick={() => { setSchedulerMode("absence"); setView("automation"); }}>再割当候補を表示</button></div>; })}</div>}
          {view === "automation" && <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]"><div className="panel p-5"><h3 className="text-lg font-bold">自動割当実行</h3><div className="mt-4 space-y-3"><select className="field" value={schedulerMode} onChange={(e) => setSchedulerMode(e.target.value as SchedulerMode)}><option value="new">新規生成</option><option value="rebalance">再編成</option><option value="absence">欠勤再割当</option></select><input className="field" type="number" value={settings.standardTravelMinutes} onChange={(e) => setSettings((prev) => ({ ...prev, standardTravelMinutes: Number(e.target.value) }))} /><button className="btn-primary w-full" onClick={runAutoAssign}>実行</button></div></div><div className="panel p-5"><h3 className="text-lg font-bold">結果サマリー</h3><p className="mt-3 text-sm">{resultSummary}</p><div className="mt-4 grid gap-3">{schedules.filter((s) => !s.staffId || s.warningCodes.length > 0).map((s) => { const client = clients.find((c) => c.id === s.clientId); const staff = staffs.find((st) => st.id === s.staffId); return <div key={s.id} className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm"><p className="font-semibold">{client?.name}</p><p>{s.scheduleDate} {s.startTime}-{s.endTime}</p><p>担当: {staff?.name ?? "未割当"}</p><p className="text-xs">{warningLabel(s.warningCodes)}</p><div className="mt-3 flex gap-2"><button className="btn-secondary" onClick={() => cycleStaff(s.id)}>代替候補</button><button className="btn-primary" onClick={() => confirmSchedule(s.id)}>確定</button></div></div>; })}</div></div></div>}
          {view === "notifications" && <div className="panel p-5"><div className="flex items-center justify-between"><h3 className="text-lg font-bold">通知管理</h3><button className="btn-primary" onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, sendStatus: "sent", sentAt: new Date().toISOString() })))}>一括送信</button></div><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-slate-500"><tr><th className="px-3 py-2">対象</th><th className="px-3 py-2">内容</th><th className="px-3 py-2">状態</th></tr></thead><tbody>{notifications.map((n) => <tr key={n.id} className="border-t border-slate-100"><td className="px-3 py-3">{staffs.find((s) => s.id === n.targetStaffId)?.name ?? n.targetStaffId}</td><td className="px-3 py-3">{n.messageBody}</td><td className="px-3 py-3">{n.sendStatus}</td></tr>)}</tbody></table></div></div>}
          {view === "history" && <div className="panel p-5"><h3 className="text-lg font-bold">変更履歴</h3><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-slate-500"><tr><th className="px-3 py-2">日時</th><th className="px-3 py-2">種別</th><th className="px-3 py-2">変更者</th><th className="px-3 py-2">理由</th></tr></thead><tbody>{changeLogs.map((l) => <tr key={l.id} className="border-t border-slate-100"><td className="px-3 py-3">{l.createdAt}</td><td className="px-3 py-3">{l.changeType}</td><td className="px-3 py-3">{l.changedBy}</td><td className="px-3 py-3">{l.reason}</td></tr>)}</tbody></table></div></div>}
          {view === "help" && (
            <div className="space-y-4">
              <div className="panel p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Help</p>
                <h3 className="mt-2 text-2xl font-bold">操作ガイド</h3>
                <p className="mt-3 text-sm text-slate-600">ログイン、取込、自動割当、週次スケジュールの基本操作をここで確認できます。</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {helpSections.map((section) => (
                  <div key={section.title} className="panel overflow-hidden p-5">
                    <h4 className="text-lg font-bold">{section.title}</h4>
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <img src={section.image} alt={section.caption} className="w-full object-cover" />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{section.caption}</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      {section.items.map((item) => (
                        <p key={item} className="leading-6">{item}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="panel p-5 text-sm text-slate-600">
                <p>本番環境: https://ai-sift.vercel.app</p>
                <p className="mt-1">GitHub: https://github.com/hatkow/ai-sift</p>
              </div>
            </div>
          )}        </section>
      </div>
    </main>
  );
}














































