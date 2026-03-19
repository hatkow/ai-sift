import {
  Client,
  Schedule,
  SchedulerMode,
  SchedulerResult,
  Staff,
  StaffAbsence,
  SystemSettings
} from "@/lib/types";

const pad = (n: number) => `${n}`.padStart(2, "0");

export function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function addMinutes(time: string, delta: number) {
  return minutesToTime(timeToMinutes(time) + delta);
}

export function startOfWeek(date: Date) {
  const result = new Date(date);
  const diff = result.getDate() - ((result.getDay() + 6) % 7);
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function isoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function generateWeekDates(anchorDate: string) {
  const weekStart = startOfWeek(new Date(anchorDate));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return isoDate(date);
  });
}

function getPreviousAssignments(schedules: Schedule[]) {
  const map = new Map<string, string>();
  schedules.forEach((schedule) => {
    if (schedule.staffId) map.set(schedule.clientId, schedule.staffId);
  });
  return map;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

function isStaffUnavailable(
  staffId: string,
  date: string,
  startTime: string,
  endTime: string,
  absences: StaffAbsence[]
) {
  return absences.some(
    (absence) =>
      absence.staffId === staffId &&
      absence.date === date &&
      overlaps(startTime, endTime, absence.startTime, absence.endTime)
  );
}

function getDaySchedules(staffId: string, date: string, schedules: Schedule[]) {
  return schedules.filter((schedule) => schedule.staffId === staffId && schedule.scheduleDate === date);
}

function countWorkMinutes(daySchedules: Schedule[]) {
  return daySchedules.reduce(
    (sum, schedule) => sum + (timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime)),
    0
  );
}

function scoreStaff(
  client: Client,
  staff: Staff,
  date: string,
  schedules: Schedule[],
  settings: SystemSettings,
  previousAssignments: Map<string, string>
) {
  let score = 0;
  const daySchedules = getDaySchedules(staff.id, date, schedules);
  const assignedVisits = daySchedules.length;
  if (previousAssignments.get(client.id) === staff.id) score += settings.continuityScore;
  if (client.priorityStaffId === staff.id) score += 25;
  if (!client.area || staff.serviceAreas.includes(client.area)) score += settings.areaMatchScore;
  if (assignedVisits === 0) score += 15;
  score += Math.max(settings.balancingScore - assignedVisits * 2, 0);
  if (staff.preferredClientIds.includes(client.id)) score += 12;
  return score;
}

function buildCandidateSlots(client: Client, weekDates: string[]) {
  const slots: Schedule[] = [];
  weekDates.forEach((date) => {
    const day = (new Date(date).getDay() + 6) % 7;
    if (!client.defaultWeekdays.includes(day)) return;
    const startTime = client.preferredTimeWindow.start;
    slots.push({
      id: `auto-${client.id}-${date}`,
      clientId: client.id,
      staffId: undefined,
      scheduleDate: date,
      startTime,
      endTime: addMinutes(startTime, client.defaultDurationMinutes),
      status: "draft",
      sourceType: "auto",
      warningCodes: []
    });
  });
  return slots.slice(0, client.frequencyPerWeek);
}

function buildScheduleKey(schedule: Schedule) {
  return `${schedule.clientId}|${schedule.scheduleDate}|${schedule.startTime}|${schedule.endTime}`;
}

function buildStaffCandidates(
  client: Client,
  slot: Schedule,
  staffs: Staff[],
  absences: StaffAbsence[],
  results: Schedule[],
  settings: SystemSettings
) {
  const baseCandidates = staffs
    .filter((staff) => staff.isActive)
    .filter((staff) => (client.candidateStaffIds.length > 0 ? client.candidateStaffIds.includes(staff.id) : true))
    .filter((staff) => !client.ngStaffIds.includes(staff.id))
    .filter((staff) => !staff.blockedClientIds.includes(client.id))
    .filter((staff) => staff.workDays.includes((new Date(slot.scheduleDate).getDay() + 6) % 7))
    .filter(
      (staff) =>
        timeToMinutes(staff.workStartTime) <= timeToMinutes(slot.startTime) &&
        timeToMinutes(staff.workEndTime) >= timeToMinutes(slot.endTime)
    )
    .filter((staff) => !isStaffUnavailable(staff.id, slot.scheduleDate, slot.startTime, slot.endTime, absences))
    .filter((staff) => {
      const daySchedules = getDaySchedules(staff.id, slot.scheduleDate, results);
      const hasOverlap = daySchedules.some((schedule) =>
        overlaps(schedule.startTime, schedule.endTime, slot.startTime, slot.endTime)
      );
      if (hasOverlap) return false;
      if (daySchedules.length >= staff.maxVisitPerDay) return false;
      const workMinutes =
        countWorkMinutes(daySchedules) +
        (timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime)) +
        settings.standardTravelMinutes * Math.max(daySchedules.length, 0);
      return workMinutes <= staff.maxWorkMinutesPerDay;
    });

  const areaMatched = baseCandidates.filter((staff) => !client.area || staff.serviceAreas.includes(client.area));
  return areaMatched.length > 0 ? areaMatched : baseCandidates;
}

export function generateSchedule({
  clients,
  staffs,
  absences,
  currentSchedules,
  settings,
  anchorDate,
  mode
}: {
  clients: Client[];
  staffs: Staff[];
  absences: StaffAbsence[];
  currentSchedules: Schedule[];
  settings: SystemSettings;
  anchorDate: string;
  mode: SchedulerMode;
}): SchedulerResult {
  const weekDates = generateWeekDates(anchorDate);
  const targetWeek = new Set(weekDates);
  const previousAssignments = getPreviousAssignments(currentSchedules);

  const lockedSchedules = currentSchedules.filter((schedule) => {
    if (!targetWeek.has(schedule.scheduleDate)) return true;
    if (schedule.status === "confirmed") return true;
    if (mode === "new" && schedule.staffId) return true;
    return false;
  });

  const pendingImportedSlots = currentSchedules
    .filter((schedule) => targetWeek.has(schedule.scheduleDate))
    .filter((schedule) => schedule.status !== "confirmed")
    .filter((schedule) => !schedule.staffId)
    .map((schedule) => ({
      ...schedule,
      sourceType: mode === "absence" ? "reassigned" : schedule.sourceType,
      warningCodes: schedule.warningCodes.filter((code) => code !== "unassigned")
    }));

  const existingWeekKeys = new Set(
    currentSchedules.filter((schedule) => targetWeek.has(schedule.scheduleDate)).map(buildScheduleKey)
  );

  const generatedSlots = clients
    .filter((client) => client.isActive && !client.contractEndDate)
    .flatMap((client) => buildCandidateSlots(client, weekDates))
    .filter((slot) => !existingWeekKeys.has(buildScheduleKey(slot)));

  const slotsToAssign = [...pendingImportedSlots, ...generatedSlots].sort((a, b) =>
    `${a.scheduleDate}${a.startTime}${a.clientId}`.localeCompare(`${b.scheduleDate}${b.startTime}${b.clientId}`)
  );

  const results = [...lockedSchedules];
  const unassigned: Schedule[] = [];
  const conflicts: { scheduleId: string; reasons: string[] }[] = [];
  const adjustments: string[] = [];

  slotsToAssign.forEach((slot) => {
    const client = clients.find((item) => item.id === slot.clientId);
    if (!client) return;

    const candidateStaffs = buildStaffCandidates(client, slot, staffs, absences, results, settings).sort(
      (a, b) =>
        scoreStaff(client, b, slot.scheduleDate, results, settings, previousAssignments) -
        scoreStaff(client, a, slot.scheduleDate, results, settings, previousAssignments)
    );

    const selected = candidateStaffs[0];
    if (!selected) {
      const warningCodes = [
        client.requiresPairVisit ? "pair_visit_required" : "unassigned",
        mode === "absence" ? "emergency_manual_needed" : "manual_adjustment_needed"
      ];
      const unresolved = { ...slot, staffId: undefined, warningCodes };
      unassigned.push(unresolved);
      conflicts.push({ scheduleId: slot.id, reasons: warningCodes });
      return;
    }

    const assigned: Schedule = {
      ...slot,
      staffId: selected.id,
      sourceType: mode === "absence" ? "reassigned" : slot.sourceType,
      warningCodes: client.requiresPairVisit ? ["pair_visit_check"] : []
    };
    if (mode === "absence") {
      adjustments.push(`${client.name} を ${selected.name} に再割当しました`);
    }
    results.push(assigned);
  });

  return {
    schedules: results.sort((a, b) =>
      `${a.scheduleDate}${a.startTime}${a.clientId}`.localeCompare(`${b.scheduleDate}${b.startTime}${b.clientId}`)
    ),
    unassigned,
    conflicts,
    adjustments
  };
}
