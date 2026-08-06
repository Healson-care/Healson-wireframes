"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Info,
  Pencil,
  Undo2,
  User,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/Misc";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { DAY_LABELS } from "@/lib/medical-tree";
import { isoDate } from "@/lib/calendar";
import { dayKeyForDate, minutesToTime, shiftsForDate, timeToMinutes } from "@/lib/schedule";
import { getUnitResources, isUnitProvider } from "@/lib/unit-resources";
import { appointmentStatusLabel, showsPatientPaymentStatus } from "@/lib/appointment-payments";
import { resolvePriceBreakdown } from "@/lib/pricing";
import {
  CalendarView,
  NO_DEPT,
  VIEW_LABELS,
  deptColor,
  rangeDays,
  rangeLabel,
  shiftAnchor,
} from "@/lib/schedule-calendar";
import {
  APPOINTMENT_STATUS_COLORS,
  ApptLane,
  OpenBand,
  SELF_LANE,
  UNASSIGNED_LANE,
  bandsForShifts,
  buildApptBlocks,
  conflictMessage,
  durationLabel,
  findApptConflict,
  isInsideBands,
  laneIdForAppointment,
  mergeBands,
  timeRangeLabel,
} from "@/lib/appointment-calendar";
import {
  APPOINTMENT_STATUSES,
  Appointment,
  AppointmentStatus,
  ConsultationType,
  BRANCH_TYPE_LABELS,
  Patient,
  ProviderProfile,
  isCancelledAppointment,
  isPractitionerProviderType,
} from "@/types";
import {
  AppointmentPaymentPanel,
  PaymentStateBadge,
  ReferralReviewPanel,
} from "@/components/provider/AppointmentReferralPanel";
import { AppointmentTimeGrid, ApptGridColumn, DropTarget } from "./AppointmentTimeGrid";
import { AppointmentMonthView } from "./AppointmentMonthView";
import { FilterSelect } from "./FilterSelect";

/** The provider's working diary — the same Day/Week/Month surface as the unit
 * availability calendar (§PRV-08), but the blocks are the patients themselves.
 *
 * One component serves both audiences, because the calendar mechanics are the
 * same and only the column model differs:
 *   • a single provider has one queue      → the day is one column;
 *   • a medical unit has one queue per עמדה → the day is a column per עמדה
 *     (MRI 1 / CT 1 / ד"ר כהן), the classic clinic day board, and dragging a
 *     patient sideways reassigns which עמדה serves them.
 *
 * Every block links straight into the patient's chart, so the diary is also the
 * way into the clinical record — the calendar IS the day's worklist. */
export function ProviderAppointmentCalendar({ provider }: { provider: ProviderProfile }) {
  const appointments = useStore((s) => s.appointments);
  const providers = useStore((s) => s.providers);
  const patients = useStore((s) => s.patients);
  const organizationBranches = useStore((s) => s.organizationBranches);
  const serviceArrays = useStore((s) => s.serviceArrays);
  const affiliationsSlice = useStore((s) => s.affiliations);
  const addAppointment = useStore((s) => s.addAppointment);
  const updateAppointment = useStore((s) => s.updateAppointment);
  const showToast = useStore((s) => s.showToast);

  const isUnit = isUnitProvider(provider);
  // An individual provider is never shown the patient's collection state — see
  // showsPatientPaymentStatus.
  const showsMoney = showsPatientPaymentStatus(provider);
  /** For a solo practitioner the person IS the calendar — pass their id into the
   * conflict guard so a booking here also respects the shifts they deliver
   * inside units (§PRV-10), not just this diary. */
  const selfPractitionerId = isPractitionerProviderType(provider.provider_type) ? provider.id : undefined;

  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<AppointmentStatus>>(new Set());
  const [laneFilter, setLaneFilter] = useState("all");
  const [arrayFilter, setArrayFilter] = useState("all");
  /** Contexts hidden from the legend (a מרפאה / a יחידה / an עמדה). */
  const [hiddenLanes, setHiddenLanes] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createState, setCreateState] = useState<DropTarget | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  // The shifts opened for booking, painted behind the appointments. On by
  // default: "which of my open hours are still free" is the question this
  // screen is really opened with.
  const [showOpenHours, setShowOpenHours] = useState(true);

  // ---------------------------------------------------------------------------
  // Lanes — a unit's עמדות, or the single lane of a solo diary
  // ---------------------------------------------------------------------------
  const doctorInfo = useMemo(
    () =>
      new Map(
        providers.map((p) => [
          p.id,
          { name: `${p.title ?? ""} ${p.display_name}`.trim(), specialty: p.specialty },
        ])
      ),
    [providers]
  );
  const unitNameById = useMemo(() => new Map(providers.map((p) => [p.id, p.display_name])), [providers]);
  const unitBranches = useMemo(
    () => organizationBranches.filter((b) => b.unit_id === provider.id),
    [organizationBranches, provider.id]
  );
  const unitArrays = useMemo(() => {
    const branchIds = new Set(unitBranches.map((b) => b.id));
    return serviceArrays.filter((a) => branchIds.has(a.branch_id));
  }, [serviceArrays, unitBranches]);
  const unitAffiliations = useMemo(
    () => affiliationsSlice.filter((a) => a.unit_id === provider.id),
    [affiliationsSlice, provider.id]
  );
  const resources = useMemo(
    () => (isUnit ? getUnitResources(provider, doctorInfo, unitArrays, unitAffiliations) : []),
    [isUnit, provider, doctorInfo, unitArrays, unitAffiliations]
  );

  // Every lane, including retired עמדות — they keep their column on days where
  // they still hold appointments. `lanes` (below) is the bookable subset.
  //
  // Each lane also carries the schedule holder its opened shifts come from, so
  // the grid can paint "these are the hours I opened" behind the appointments:
  // for a unit that's the עמדה itself, for a solo provider it's their מרפאות.
  const allLanes: ApptLane[] = useMemo(() => {
    if (!isUnit) {
      // A solo provider's day is split by CONTEXT, because the two kinds of
      // work answer to different owners: their own מרפאות (theirs to schedule)
      // and each יחידה they're affiliated with (the unit schedules, they show
      // up). Blurring the two is what made the diary unreadable.
      const own: ApptLane[] = provider.clinic_locations.map((c) => ({
        id: c.id,
        name: c.name,
        subtitle: BRANCH_TYPE_LABELS[c.location_type ?? "clinic"],
        kind: "self",
        isActive: true,
        serviceIds: provider.consultation_types
          .filter((s) => (s.linked_clinic_ids?.length ?? 0) === 0 || s.linked_clinic_ids!.includes(c.id))
          .map((s) => s.id),
        practitionerId: selfPractitionerId,
        scheduleHolders: [c],
      }));
      // One lane per unit this provider actually works in — from the
      // affiliations slice, plus any unit that already booked them (a legacy
      // link with no affiliation record still has to be visible).
      const unitIds = new Set<string>([
        ...affiliationsSlice.filter((a) => a.provider_id === provider.id).map((a) => a.unit_id),
        ...appointments
          .filter((a) => a.practitioner_id === provider.id && a.provider_id !== provider.id)
          .map((a) => a.provider_id ?? ""),
      ]);
      unitIds.delete("");
      const units: ApptLane[] = [...unitIds].map((unitId) => {
        const affiliation = affiliationsSlice.find(
          (a) => a.provider_id === provider.id && a.unit_id === unitId
        );
        return {
          id: unitId,
          name: unitNameById.get(unitId) ?? "יחידה",
          subtitle: affiliation?.role ?? "שיבוצי יחידה",
          kind: "unit",
          isActive: true,
          readOnly: true,
          serviceIds: affiliation?.service_ids ?? [],
          practitionerId: provider.id,
          // The hours committed to that unit — the unit owns them, but they're
          // this person's time, so they belong on this timeline.
          scheduleHolders: affiliation ? [affiliation] : [],
        };
      });
      return own.length > 0 || units.length > 0
        ? [...own, ...units]
        : [
            {
              id: SELF_LANE,
              name: provider.display_name,
              kind: "self",
              isActive: true,
              serviceIds: provider.consultation_types.map((s) => s.id),
              practitionerId: selfPractitionerId,
              scheduleHolders: [],
            },
          ];
    }
    return resources.map((r) => ({
      id: r.id,
      name: r.name,
      subtitle: r.subtitle,
      kind: r.kind,
      isActive: r.is_active,
      serviceIds: r.service_ids,
      practitionerId: r.practitioner_id,
      arrayId: r.service_array_id,
      arrayName: r.service_array,
      branchId: r.branch_id,
      scheduleHolders: [r],
    }));
  }, [
    isUnit,
    resources,
    appointments,
    affiliationsSlice,
    unitNameById,
    provider.id,
    provider.display_name,
    provider.consultation_types,
    provider.clinic_locations,
    selfPractitionerId,
  ]);

  /** Lanes this calendar may book into — a unit's live עמדות, or the provider's
   * own מרפאות (never a unit's queue: that one belongs to the unit). */
  const lanes = useMemo(() => allLanes.filter((l) => l.isActive && !l.readOnly), [allLanes]);
  const laneById = useMemo(() => new Map(allLanes.map((l) => [l.id, l])), [allLanes]);
  const laneOrder = useMemo(() => allLanes.map((l) => l.id), [allLanes]);
  // A provider with exactly one מרפאה has no ambiguity, so a booking with no
  // clinic_id on file belongs to it rather than to a "ללא מיקום" limbo column.
  const defaultLaneId = useMemo(
    () => (!isUnit && provider.clinic_locations.length === 1 ? provider.clinic_locations[0].id : undefined),
    [isUnit, provider.clinic_locations]
  );
  const laneNames = useMemo(() => {
    const m = new Map(allLanes.map((l) => [l.id, l.name]));
    m.set(UNASSIGNED_LANE, isUnit ? "ללא עמדה" : "ללא מיקום");
    return m;
  }, [isUnit, allLanes]);
  const deptOrder = useMemo(() => unitArrays.map((a) => a.id), [unitArrays]);
  /** Colour of a lane's rail/dot: a unit colours by מערך (the עמדה is already a
   * column), a solo diary colours by context. */
  const railFor = useMemo(
    () => (laneId: string) =>
      isUnit
        ? deptColor(laneById.get(laneId)?.arrayId, deptOrder).accent
        : deptColor(laneId, laneOrder).accent,
    [isUnit, laneById, deptOrder, laneOrder]
  );
  const railDot = useMemo(
    () => (lane: ApptLane) =>
      isUnit ? deptColor(lane.arrayId, deptOrder).dot : deptColor(lane.id, laneOrder).dot,
    [isUnit, deptOrder, laneOrder]
  );

  // ---------------------------------------------------------------------------
  // Appointments in scope + filters
  // ---------------------------------------------------------------------------
  // The unified diary (§PRV-10): what this calendar owns, PLUS what this person
  // delivers inside a unit — the latter as a read-only reflection, so the day is
  // honest across every context they work in.
  const scoped = useMemo(
    () => appointments.filter((a) => a.provider_id === provider.id || a.practitioner_id === provider.id),
    [appointments, provider.id]
  );

  const laneOf = useMemo(
    () => (a: Appointment) =>
      laneIdForAppointment(a, { isUnit, ownerId: provider.id, defaultLaneId }),
    [isUnit, provider.id, defaultLaneId]
  );

  const visible = useMemo(
    () =>
      scoped.filter((a) => {
        if (hiddenStatuses.has(a.status)) return false;
        const laneId = laneOf(a);
        if (hiddenLanes.has(laneId)) return false;
        if (laneFilter !== "all" && laneId !== laneFilter) return false;
        if (isUnit && arrayFilter !== "all" && (laneById.get(laneId)?.arrayId ?? NO_DEPT) !== arrayFilter) {
          return false;
        }
        return true;
      }),
    [scoped, hiddenStatuses, hiddenLanes, laneOf, laneFilter, arrayFilter, isUnit, laneById]
  );

  const dates = useMemo(() => (view === "month" ? [] : rangeDays(view, anchor)), [view, anchor]);
  const blocks = useMemo(
    () =>
      buildApptBlocks(visible, dates, {
        ownerId: provider.id,
        isUnit,
        laneNames,
        defaultLaneId,
        railClassFor: railFor,
      }),
    [visible, dates, provider.id, isUnit, laneNames, defaultLaneId, railFor]
  );

  // "Is this appointment inside the range currently on screen" — the month view
  // isn't windowed by `dates` (it draws its own month grid), so it gets its own
  // arm rather than an empty set that would silently match nothing.
  const inRange = useMemo(() => {
    if (view === "month") {
      const prefix = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}`;
      return (date: string) => date.startsWith(prefix);
    }
    const isoDates = new Set(dates.map(isoDate));
    return (date: string) => isoDates.has(date);
  }, [view, anchor, dates]);

  // Status legend — only statuses that actually occur in this provider's diary,
  // with live counts for the range on screen. Where several statuses read as
  // the same thing to this provider (the payment phases, for an individual —
  // see appointmentStatusLabel) they share one chip and hide together, so the
  // legend never shows the same word twice.
  const legend = useMemo(() => {
    const counts = new Map<AppointmentStatus, number>();
    for (const a of scoped) {
      if (!inRange(a.date)) continue;
      counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
    }
    const groups = new Map<string, { label: string; statuses: AppointmentStatus[]; count: number }>();
    for (const status of APPOINTMENT_STATUSES) {
      const count = counts.get(status) ?? 0;
      if (count === 0 && !hiddenStatuses.has(status)) continue;
      const label = appointmentStatusLabel(status, showsMoney);
      const group = groups.get(label);
      if (group) {
        group.statuses.push(status);
        group.count += count;
      } else {
        groups.set(label, { label, statuses: [status], count });
      }
    }
    return [...groups.values()];
  }, [scoped, inRange, hiddenStatuses, showsMoney]);

  const monthAppointments = useMemo(
    () => (view === "month" ? visible.filter((a) => inRange(a.date)) : []),
    [visible, view, inRange]
  );

  // How many appointments each context holds in the range on screen — counted
  // before the lane-visibility filter, so hiding one doesn't zero its own chip.
  const contextCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of scoped) {
      if (!inRange(a.date) || isCancelledAppointment(a.status)) continue;
      const laneId = laneOf(a);
      counts.set(laneId, (counts.get(laneId) ?? 0) + 1);
    }
    return counts;
  }, [scoped, inRange, laneOf]);

  // ---------------------------------------------------------------------------
  // Columns
  // ---------------------------------------------------------------------------
  const todayIso = isoDate(new Date());
  // The day view is a board of queues — a unit's עמדות, or a solo provider's
  // contexts (their מרפאות and each יחידה). That's what makes "mine vs. the
  // unit's" structural instead of a hint on a card.
  const laneColumnMode = view === "day";

  const visibleLanes = useMemo(
    () =>
      allLanes.filter((l) => {
        if (hiddenLanes.has(l.id)) return false;
        if (laneFilter !== "all" && l.id !== laneFilter) return false;
        if (isUnit && arrayFilter !== "all" && (l.arrayId ?? NO_DEPT) !== arrayFilter) return false;
        return true;
      }),
    [allLanes, hiddenLanes, laneFilter, arrayFilter, isUnit]
  );

  /** The hours a set of lanes has open on a date — one lane's own shifts stay
   * labelled (with their breaks), several lanes merge into a plain envelope. */
  function bandsFor(lanes: ApptLane[], iso: string): OpenBand[] {
    const holders = lanes.flatMap((l) => l.scheduleHolders ?? []);
    if (holders.length === 0) return [];
    const bands = holders.flatMap((h) => bandsForShifts(shiftsForDate(h, iso)));
    return holders.length === 1 ? bands : mergeBands(bands);
  }

  const blockedByDate = useMemo(
    () => new Map((provider.blocked_dates ?? []).map((b) => [b.date, b.reason || "יום חסום"])),
    [provider.blocked_dates]
  );

  const columns: ApptGridColumn[] = useMemo(() => {
    if (view === "month") return [];
    if (laneColumnMode) {
      const date = dates[0];
      const iso = isoDate(date);
      const isToday = iso === todayIso;
      const blockedReason = blockedByDate.get(iso);
      const busyLaneIds = new Set(blocks.filter((b) => b.date === iso).map((b) => b.laneId));
      const cols: ApptGridColumn[] = visibleLanes
        .map((l) => ({ lane: l, bands: bandsFor([l], iso) }))
        .filter(({ lane, bands }) => {
          if (busyLaneIds.has(lane.id)) return true; // it holds work today
          if (!lane.isActive) return false; // retired and empty
          // A unit's column earns its place on a day I actually have hours
          // there — otherwise every unit I'm affiliated with would add an empty
          // column to every day of my week.
          if (lane.readOnly) return bands.length > 0;
          return true; // my own queues are always part of my day
        })
        .map(({ lane: l, bands }) => ({
          key: l.id,
          date,
          title: l.isActive ? l.name : `${l.name} · לא פעילה`,
          subtitle: l.arrayName ?? l.subtitle,
          laneId: l.id,
          isToday,
          dotClass: railDot(l),
          readOnly: !l.isActive || !!l.readOnly,
          ownerNote: l.readOnly ? "מנוהל על ידי היחידה" : undefined,
          openBands: bands,
          blockedReason: l.readOnly ? undefined : blockedReason,
        }));
      // Bookings with no queue on file (a unit booking predating the resource
      // model, an old appointment with no clinic) still belong to the day —
      // give them a visible, non-droppable column rather than hiding them.
      if (blocks.some((b) => b.date === iso && b.laneId === UNASSIGNED_LANE)) {
        cols.push({
          key: UNASSIGNED_LANE,
          date,
          title: isUnit ? "ללא עמדה" : "ללא מיקום",
          subtitle: "תורים שלא שויכו",
          laneId: UNASSIGNED_LANE,
          isToday,
          readOnly: true,
        });
      }
      return cols;
    }
    return dates.map((d) => {
      const iso = isoDate(d);
      return {
        key: iso,
        date: d,
        title: DAY_LABELS[dayKeyForDate(d)],
        subtitle: d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }),
        isToday: iso === todayIso,
        // A date column spans every visible lane, so its band is the envelope:
        // the hours SOMETHING of mine is open.
        openBands: bandsFor(visibleLanes, iso),
        blockedReason: blockedByDate.get(iso),
      };
    });
  }, [view, laneColumnMode, dates, visibleLanes, isUnit, blocks, todayIso, blockedByDate, railDot]);

  const columnKeyOf = useMemo(
    () => (laneColumnMode ? (b: { laneId: string }) => b.laneId : (b: { date: string }) => b.date),
    [laneColumnMode]
  );

  // ---------------------------------------------------------------------------
  // Undo — one step back for every scheduling mutation made here
  // ---------------------------------------------------------------------------
  type UndoEntry = { id: string; prev: Partial<Appointment> };
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  function pushUndo(a: Appointment) {
    setUndoStack((s) => [
      ...s.slice(-19),
      {
        id: a.id,
        prev: {
          date: a.date,
          time: a.time,
          duration_minutes: a.duration_minutes,
          status: a.status,
          notes: a.notes,
          resource_id: a.resource_id,
          practitioner_id: a.practitioner_id,
          owner_context_id: a.owner_context_id,
        },
      },
    ]);
  }

  function undo() {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    // Side effects stay outside the state updater — React runs updaters during
    // render. The keyboard effect below re-subscribes on every stack change, so
    // this closure is never stale.
    setUndoStack((s) => s.slice(0, -1));
    updateAppointment(last.id, last.prev);
    showToast("הפעולה בוטלה", { variant: "success" });
  }

  // ---------------------------------------------------------------------------
  // Scheduling mutations
  // ---------------------------------------------------------------------------
  /** Where an appointment would sit after a change, resolved into the ids the
   * conflict guard and the record itself need. */
  function resolvePlacement(a: Appointment, laneId: string) {
    if (!isUnit) {
      // A solo provider's lanes are their own מרפאות: moving between them
      // re-homes the appointment's location. The person's queue is unchanged —
      // they still can't be in two places at once, which is exactly what the
      // conflict guard below keeps checking provider-wide.
      const lane = laneById.get(laneId);
      const movedLocation = lane && !lane.readOnly && laneId !== a.clinic_id && laneId !== SELF_LANE;
      return {
        resourceId: undefined as string | undefined,
        practitionerId: a.practitioner_id ?? selfPractitionerId,
        patch: (movedLocation ? { clinic_id: laneId } : {}) as Partial<Appointment>,
      };
    }
    if (laneId === UNASSIGNED_LANE || laneId === a.resource_id) {
      return { resourceId: a.resource_id, practitionerId: a.practitioner_id, patch: {} as Partial<Appointment> };
    }
    const lane = laneById.get(laneId);
    return {
      resourceId: laneId,
      practitionerId: lane?.practitionerId,
      // Moving to another עמדה moves the whole ownership triple with it
      // (§PRV-10): the queue, the owning context and the delivering person.
      patch: {
        resource_id: laneId,
        owner_context_id: laneId,
        practitioner_id: lane?.practitionerId,
      } as Partial<Appointment>,
    };
  }

  function tryReschedule(
    a: Appointment,
    next: { date: string; startMin: number; durationMin: number; laneId: string },
    successMessage: string
  ) {
    const placement = resolvePlacement(a, next.laneId);
    const conflict = findApptConflict(appointments, {
      contextId: provider.id,
      resourceId: placement.resourceId,
      practitionerId: placement.practitionerId,
      date: next.date,
      startMin: next.startMin,
      durationMin: next.durationMin,
      excludeId: a.id,
    });
    if (conflict) {
      showToast("לא ניתן לשבץ כאן", {
        description: conflictMessage(conflict, {
          contextId: provider.id,
          resourceId: placement.resourceId,
          practitionerId: placement.practitionerId,
          date: next.date,
          startMin: next.startMin,
          durationMin: next.durationMin,
        }),
        variant: "destructive",
      });
      return false;
    }
    pushUndo(a);
    updateAppointment(a.id, {
      date: next.date,
      time: minutesToTime(next.startMin),
      duration_minutes: next.durationMin,
      ...placement.patch,
    });
    showToast(successMessage, { variant: "success" });
    return true;
  }

  function handleMove(block: { appt: Appointment; laneId: string; startMin: number; endMin: number }, target: DropTarget) {
    const a = block.appt;
    const laneId = target.laneId ?? block.laneId;
    const changedLane = laneId !== block.laneId;
    tryReschedule(
      a,
      {
        date: target.date,
        startMin: target.startMin,
        durationMin: block.endMin - block.startMin,
        laneId,
      },
      changedLane
        ? `${a.client_name} הועבר/ה ל${laneById.get(laneId)?.name ?? (isUnit ? "עמדה" : "מיקום")}`
        : "התור הועבר"
    );
  }

  function handleResize(block: { appt: Appointment; laneId: string; startMin: number }, endMin: number) {
    const a = block.appt;
    tryReschedule(
      a,
      {
        date: a.date,
        startMin: block.startMin,
        durationMin: Math.max(15, endMin - block.startMin),
        laneId: block.laneId,
      },
      "משך התור עודכן"
    );
  }

  function setStatus(a: Appointment, status: AppointmentStatus, message: string) {
    pushUndo(a);
    updateAppointment(a.id, { status });
    showToast(message, { variant: "success" });
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts — same vocabulary as the availability calendar
  // ---------------------------------------------------------------------------
  const dialogOpen = !!detailId || !!createState || !!cancelId;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (dialogOpen) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        undo();
      } else if (e.key === "ArrowRight") {
        setAnchor((a) => shiftAnchor(view, a, -1)); // RTL: right = previous
      } else if (e.key === "ArrowLeft") {
        setAnchor((a) => shiftAnchor(view, a, 1));
      } else if (e.key === "t" || e.key === "T") {
        setAnchor(new Date());
      } else if (e.key === "1") setView("day");
      else if (e.key === "2") setView("week");
      else if (e.key === "3") setView("month");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, dialogOpen, undoStack]);

  // Nothing open anywhere in the visible range is a real operational problem —
  // the diary stays empty because patients are never offered a slot.
  const hasNoOpenHours =
    view !== "month" && columns.length > 0 && columns.every((c) => (c.openBands?.length ?? 0) === 0);

  const detail = detailId ? appointments.find((a) => a.id === detailId) : undefined;
  // A unit with no עמדות modelled yet still books against its general hours
  // (the unmodelled fallback in unit-resources) — only a missing catalog blocks.
  const canBook = provider.consultation_types.length > 0;
  const rangeCount = blocks.filter((b) => !isCancelledAppointment(b.status)).length;

  function openCreate(target?: DropTarget) {
    const fallbackDate = view === "month" ? new Date() : dates[0] ?? new Date();
    setCreateState(
      target ?? {
        date: isoDate(fallbackDate),
        startMin: 9 * 60,
        laneId: laneColumnMode ? visibleLanes.find((l) => l.isActive && !l.readOnly)?.id : undefined,
      }
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
            <Button variant="ghost" size="sm" aria-label="הקודם" onClick={() => setAnchor((a) => shiftAnchor(view, a, -1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={() => setAnchor(new Date())}
              className="focus-ring rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              היום
            </button>
            <Button variant="ghost" size="sm" aria-label="הבא" onClick={() => setAnchor((a) => shiftAnchor(view, a, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <p className="min-w-[8rem] text-sm font-bold text-slate-900">{rangeLabel(view, anchor)}</p>
            {view !== "month" && (
              <p className="text-[11px] text-slate-500">
                {rangeCount === 0 ? "אין תורים בטווח" : `${rangeCount} תורים`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
            {(Object.keys(VIEW_LABELS) as CalendarView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "focus-ring rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  view === v ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={undoStack.length === 0}
            aria-label="בטל פעולה אחרונה"
            title="בטל (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => openCreate()} disabled={!canBook}>
            <CalendarPlus className="h-4 w-4" /> תור חדש
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {isUnit ? (
          <>
            {unitArrays.length > 0 && (
              <FilterSelect
                label="מערך"
                value={arrayFilter}
                onChange={(v) => {
                  setArrayFilter(v);
                  setLaneFilter("all");
                }}
                options={[
                  { value: "all", label: "כל המערכים" },
                  ...unitArrays.map((a) => ({ value: a.id, label: a.name })),
                  ...(allLanes.some((l) => !l.arrayId) ? [{ value: NO_DEPT, label: "ללא מערך" }] : []),
                ]}
              />
            )}
            <FilterSelect
              label="עמדה"
              value={laneFilter}
              onChange={setLaneFilter}
              options={[
                { value: "all", label: "כל העמדות" },
                ...allLanes
                  .filter((l) => arrayFilter === "all" || (l.arrayId ?? NO_DEPT) === arrayFilter)
                  .map((l) => ({ value: l.id, label: l.isActive ? l.name : `${l.name} · לא פעילה` })),
              ]}
            />
          </>
        ) : (
          allLanes.length > 1 && (
            <FilterSelect
              label="הקשר"
              value={laneFilter}
              onChange={setLaneFilter}
              options={[
                { value: "all", label: "כל היומן" },
                ...allLanes.map((l) => ({
                  value: l.id,
                  label: l.readOnly ? `${l.name} (יחידה)` : l.name,
                })),
              ]}
            />
          )
        )}
        <button
          type="button"
          onClick={() => setShowOpenHours((v) => !v)}
          aria-pressed={showOpenHours}
          className={cn(
            "focus-ring flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
            showOpenHours
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          )}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          {showOpenHours ? "המשמרות שלי מוצגות" : "הצג את המשמרות שלי"}
        </button>

        {(laneFilter !== "all" || arrayFilter !== "all" || hiddenLanes.size > 0 || hiddenStatuses.size > 0) && (
          <button
            type="button"
            onClick={() => {
              setLaneFilter("all");
              setArrayFilter("all");
              setHiddenLanes(new Set());
              setHiddenStatuses(new Set());
            }}
            className="focus-ring flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
          >
            <X className="h-3 w-3" /> נקה סינון
          </button>
        )}
      </div>

      {/* Context legend (solo) — WHERE the work happens: my clinics vs. the
          units that schedule me. The colour matches each block's leading rail,
          so a block's origin is readable even in week view. */}
      {!isUnit && allLanes.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {allLanes.map((l) => {
            const hidden = hiddenLanes.has(l.id);
            const count = contextCounts.get(l.id) ?? 0;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() =>
                  setHiddenLanes((prev) => {
                    const next = new Set(prev);
                    if (next.has(l.id)) next.delete(l.id);
                    else next.add(l.id);
                    return next;
                  })
                }
                title={hidden ? "הצג הקשר" : "הסתר הקשר"}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                  hidden
                    ? "border-slate-200 bg-slate-50 text-slate-400 line-through"
                    : l.readOnly
                    ? "border-dashed border-slate-300 bg-white text-slate-600"
                    : "border-slate-200 bg-white text-slate-700"
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", hidden ? "bg-slate-300" : railDot(l))} />
                {l.readOnly ? <Building2 className="h-3 w-3 opacity-70" /> : <User className="h-3 w-3 opacity-70" />}
                {l.name}
                <span className="opacity-60">{l.readOnly ? "· יחידה" : "· שלי"}</span>
                <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Status legend — click to hide/show a status */}
      {legend.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {legend.map(({ label, statuses, count }) => {
            const hidden = statuses.every((s) => hiddenStatuses.has(s));
            const color = APPOINTMENT_STATUS_COLORS[statuses[0]];
            return (
              <button
                key={label}
                type="button"
                onClick={() =>
                  setHiddenStatuses((prev) => {
                    const next = new Set(prev);
                    for (const s of statuses) {
                      if (hidden) next.delete(s);
                      else next.add(s);
                    }
                    return next;
                  })
                }
                title={hidden ? "הצג סטטוס" : "הסתר סטטוס"}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                  hidden ? "border-slate-200 bg-slate-50 text-slate-400 line-through" : color.chip
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", hidden ? "bg-slate-300" : color.dot)} />
                {label}
                <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* The calendar surface */}
      {view === "month" ? (
        <AppointmentMonthView
          anchor={anchor}
          appointments={monthAppointments}
          onPickDay={(d) => {
            setAnchor(d);
            setView("day");
          }}
        />
      ) : columns.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-10 w-10" />}
          title={isUnit ? "אין עמדות להצגה" : "אין יומן להצגה"}
          description={
            isUnit
              ? "כל העמדות מוסתרות על ידי הסינון, או שטרם הוגדרו עמדות ביחידה. הוסיפו עמדות בלשונית ‚זמינות ולוח זמנים‘."
              : "נקו את הסינון כדי לראות את היומן."
          }
        />
      ) : (
        <AppointmentTimeGrid
          columns={columns}
          blocks={blocks}
          columnKeyOf={columnKeyOf}
          canCreate={canBook}
          showOpenHours={showOpenHours}
          showMoneyFlag={showsMoney}
          onCreate={openCreate}
          onOpen={(b) => setDetailId(b.appt.id)}
          onMove={handleMove}
          onResize={handleResize}
        />
      )}

      {/* What the surface is telling you — the shift layer, then block semantics */}
      {view !== "month" && (
        <div className="flex flex-col gap-1 text-[11px] text-slate-500">
          {showOpenHours && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded-sm border border-slate-200 bg-white" />
                שעות שפתחת לקביעת תורים
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded-sm border border-slate-200" style={CLOSED_SWATCH} />
                מחוץ למשמרות — לא מוצע למטופלים
              </span>
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                תור שנקבע מחוץ למשמרת
              </span>
            </p>
          )}
          {hasNoOpenHours && (
            <p className="flex items-center gap-1.5 text-warning-text">
              <AlertTriangle className="h-3.5 w-3.5" />
              לא נפתחו משמרות בטווח המוצג — מטופלים לא יכולים לקבוע כאן תור.{" "}
              <Link href="/provider/profile/availability" className="font-medium underline">
                פתיחת משמרות
              </Link>
            </p>
          )}
          {scoped.some((a) => a.provider_id !== provider.id) && (
            <p className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {view === "day"
                ? "לעמודות של יחידה יש מסגרת נעולה: התורים שם נקבעו על ידי היחידה — אפשר לצפות ולפתוח תיק מטופל, אבל לא לשנות או לגרור אליהן."
                : "תורים במסגרת מקווקוות עם מנעול הם שיבוצים של יחידה — לצפייה בלבד. עברו לתצוגת ‚יום‘ כדי לראות עמודה נפרדת לכל מרפאה וכל יחידה."}
            </p>
          )}
        </div>
      )}

      <AppointmentDetailDialog
        appointment={detail}
        provider={provider}
        isUnit={isUnit}
        laneName={detail ? laneNames.get(laneOf(detail)) : undefined}
        laneId={detail ? laneOf(detail) : undefined}
        unitName={detail && detail.provider_id !== provider.id ? unitNameById.get(detail.provider_id ?? "") : undefined}
        lanes={lanes}
        onClose={() => setDetailId(null)}
        onSetStatus={setStatus}
        onCancel={(id) => setCancelId(id)}
        onSave={(a, next, patch) => {
          const ok = tryReschedule(a, next, "התור עודכן");
          if (ok && Object.keys(patch).length > 0) updateAppointment(a.id, patch);
          if (ok) setDetailId(null);
        }}
      />

      <NewAppointmentDialog
        state={createState}
        provider={provider}
        isUnit={isUnit}
        lanes={lanes}
        patients={patients}
        appointments={appointments}
        selfPractitionerId={selfPractitionerId}
        openBandsFor={(laneId, iso) => {
          const lane = laneById.get(laneId);
          return bandsFor(lane ? [lane] : [], iso);
        }}
        onClose={() => setCreateState(null)}
        onCreate={(draft) => {
          const created = addAppointment(draft);
          showToast("התור נקבע", {
            description: `${created.client_name} · ${created.date} ${created.time}`,
            variant: "success",
          });
          setCreateState(null);
          setAnchor(new Date(`${created.date}T00:00:00`));
        }}
      />

      <ConfirmDialog
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        title="ביטול תור"
        description="התור יסומן כמבוטל והמשבצת תתפנה. ניתן לבטל את הפעולה מיד לאחר מכן."
        destructive
        confirmLabel="בטל תור"
        onConfirm={() => {
          const a = appointments.find((x) => x.id === cancelId);
          if (a) setStatus(a, "בוטל", "התור בוטל");
          setCancelId(null);
          setDetailId(null);
        }}
      />
    </div>
  );
}

// Legend swatch for the closed hatch — same recipe as the grid's CLOSED_HATCH,
// so the key and the surface can't drift apart visually.
const CLOSED_SWATCH: React.CSSProperties = {
  backgroundColor: "rgba(248,250,252,0.95)",
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(148,163,184,0.35) 0, rgba(148,163,184,0.35) 2px, transparent 2px, transparent 5px)",
};

// ---------------------------------------------------------------------------
// Detail / edit dialog
// ---------------------------------------------------------------------------
function AppointmentDetailDialog({
  appointment,
  provider,
  isUnit,
  laneName,
  laneId,
  unitName,
  lanes,
  onClose,
  onSetStatus,
  onCancel,
  onSave,
}: {
  appointment?: Appointment;
  provider: ProviderProfile;
  isUnit: boolean;
  laneName?: string;
  laneId?: string;
  unitName?: string;
  lanes: ApptLane[];
  onClose: () => void;
  onSetStatus: (a: Appointment, status: AppointmentStatus, message: string) => void;
  onCancel: (id: string) => void;
  onSave: (
    a: Appointment,
    next: { date: string; startMin: number; durationMin: number; laneId: string },
    patch: Partial<Appointment>
  ) => void;
}) {
  return (
    <Dialog open={!!appointment} onClose={onClose} title="פרטי התור" className="max-w-lg">
      {appointment && (
        <DetailBody
          key={appointment.id}
          appointment={appointment}
          provider={provider}
          isUnit={isUnit}
          laneName={laneName}
          laneId={laneId}
          unitName={unitName}
          lanes={lanes}
          onSetStatus={onSetStatus}
          onCancel={onCancel}
          onSave={onSave}
        />
      )}
    </Dialog>
  );
}

function DetailBody({
  appointment: a,
  provider,
  isUnit,
  laneName,
  laneId,
  unitName,
  lanes,
  onSetStatus,
  onCancel,
  onSave,
}: {
  appointment: Appointment;
  provider: ProviderProfile;
  isUnit: boolean;
  laneName?: string;
  laneId?: string;
  unitName?: string;
  lanes: ApptLane[];
  onSetStatus: (a: Appointment, status: AppointmentStatus, message: string) => void;
  onCancel: (id: string) => void;
  onSave: (
    a: Appointment,
    next: { date: string; startMin: number; durationMin: number; laneId: string },
    patch: Partial<Appointment>
  ) => void;
}) {
  const owned = a.provider_id === provider.id;
  const showsMoney = showsPatientPaymentStatus(provider);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    date: a.date,
    time: a.time,
    duration_minutes: a.duration_minutes,
    notes: a.notes ?? "",
    laneId: laneId ?? UNASSIGNED_LANE,
  });

  const startMin = timeToMinutes(a.time);
  const endMin = startMin + Math.max(15, a.duration_minutes || 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Summary */}
      <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold text-slate-900">{a.client_name}</p>
          <p className="text-xs text-slate-600">{a.service_name}</p>
          <p dir="ltr" className="mt-1 text-xs font-medium tabular-nums text-slate-500">
            {a.date} · {timeRangeLabel(startMin, endMin)} · {durationLabel(a.duration_minutes)}
          </p>
          {a.client_phone && (
            <a href={`tel:${a.client_phone}`} dir="ltr" className="text-xs text-primary hover:underline">
              {a.client_phone}
            </a>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge
            status={a.status}
            kind="appointment"
            label={appointmentStatusLabel(a.status, showsMoney)}
          />
          {/* Collection state is a unit's own work; for an individual provider
              Healson collects and settles, so it is not shown at all. */}
          {showsMoney && <PaymentStateBadge appointment={a} />}
          {laneName && laneName !== provider.display_name && <Badge tone="neutral">{laneName}</Badge>}
          {typeof a.price === "number" && (
            <span className="text-xs font-medium text-slate-600">{formatCurrency(a.price)}</span>
          )}
        </div>
      </div>

      {!owned && (
        <p className="flex items-start gap-2 rounded-lg bg-info-bg px-3 py-2 text-xs leading-relaxed text-info-text">
          <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          שיבוץ של {unitName ?? "יחידה"} — הוא מוצג ביומן שלך כדי שהיום יהיה מלא ונכון, אך שינוי או ביטול מתבצעים על
          ידי היחידה.
        </p>
      )}

      {/* The referral decision and the money picture — the two things a
          provider needs on an incoming booking (payments meeting §7). Both are
          owner-only: a reflection of another calendar's booking is read-only.
          For an individual provider the second panel keeps only the payer's
          התחייבות, since the collection itself is Healson's. */}
      {owned && <ReferralReviewPanel appointment={a} />}
      {owned && <AppointmentPaymentPanel appointment={a} showMoney={showsMoney} />}

      {a.notes && !editing && (
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <p className="text-[11px] font-medium text-slate-400">הערות</p>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{a.notes}</p>
        </div>
      )}

      {editing && owned && (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="date"
              label="תאריך"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
            <Input
              type="time"
              label="שעה"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
            <Input
              type="number"
              min={15}
              step={5}
              label="משך (דקות)"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
            />
            {lanes.length > 1 && (
              <Select
                label={isUnit ? "עמדה" : "מיקום"}
                value={form.laneId}
                onChange={(e) => setForm({ ...form, laneId: e.target.value })}
              >
                {/* The current placement always stays selectable, even when it's
                    "ללא עמדה" or a retired עמדה that's no longer bookable. */}
                {!lanes.some((l) => l.id === form.laneId) && (
                  <option value={form.laneId}>{laneName ?? (isUnit ? "ללא עמדה" : "ללא מיקום")}</option>
                )}
                {lanes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.arrayName ? ` · ${l.arrayName}` : ""}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <Textarea label="הערות" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              ביטול
            </Button>
            <Button
              size="sm"
              onClick={() =>
                onSave(
                  a,
                  {
                    date: form.date,
                    startMin: timeToMinutes(form.time),
                    durationMin: Math.max(15, form.duration_minutes || 15),
                    laneId: form.laneId,
                  },
                  form.notes !== (a.notes ?? "") ? { notes: form.notes } : {}
                )
              }
            >
              שמור שינויים
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap justify-end gap-2">
        {a.created_by_id && (
          <Link href={`/provider/patients/${a.created_by_id}`}>
            <Button size="sm" variant="outline">
              <FolderOpen className="h-3.5 w-3.5" /> פתח תיק מטופל
            </Button>
          </Link>
        )}
        {owned && a.status !== "בוטל" && (
          <>
            {a.status === "ממתין לתשלום מקדמה" && (
              <Button size="sm" onClick={() => onSetStatus(a, "מאושר", "התור אושר")}>
                <Check className="h-3.5 w-3.5" /> אשר תור
              </Button>
            )}
            {(a.status === "מאושר" || a.status === "שולם במלואו") && (
              <Button size="sm" variant="secondary" onClick={() => onSetStatus(a, "בוצע", "התור סומן כבוצע")}>
                <Check className="h-3.5 w-3.5" /> סמן כבוצע
              </Button>
            )}
            {!editing && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> עריכה
              </Button>
            )}
            {a.status !== "בוצע" && (
              <Button size="sm" variant="destructive" onClick={() => onCancel(a.id)}>
                <X className="h-3.5 w-3.5" /> בטל תור
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New appointment
// ---------------------------------------------------------------------------
const NEW_PATIENT = "__new__";

function NewAppointmentDialog({
  state,
  provider,
  isUnit,
  lanes,
  patients,
  appointments,
  selfPractitionerId,
  openBandsFor,
  onClose,
  onCreate,
}: {
  state: DropTarget | null;
  provider: ProviderProfile;
  isUnit: boolean;
  lanes: ApptLane[];
  patients: Patient[];
  appointments: Appointment[];
  selfPractitionerId?: string;
  openBandsFor: (laneId: string, date: string) => OpenBand[];
  onClose: () => void;
  onCreate: (draft: Omit<Appointment, "id">) => void;
}) {
  return (
    <Dialog open={!!state} onClose={onClose} title="תור חדש" className="max-w-lg">
      {state && (
        <NewAppointmentBody
          state={state}
          provider={provider}
          isUnit={isUnit}
          lanes={lanes}
          patients={patients}
          appointments={appointments}
          selfPractitionerId={selfPractitionerId}
          openBandsFor={openBandsFor}
          onCreate={onCreate}
        />
      )}
    </Dialog>
  );
}

function NewAppointmentBody({
  state,
  provider,
  isUnit,
  lanes,
  patients,
  appointments,
  selfPractitionerId,
  openBandsFor,
  onCreate,
}: {
  state: DropTarget;
  provider: ProviderProfile;
  isUnit: boolean;
  lanes: ApptLane[];
  patients: Patient[];
  appointments: Appointment[];
  selfPractitionerId?: string;
  openBandsFor: (laneId: string, date: string) => OpenBand[];
  onCreate: (draft: Omit<Appointment, "id">) => void;
}) {
  // Who this provider may book: their own patients, plus anyone they already
  // have an appointment with (a unit's patients are rarely "assigned" to it).
  const bookablePatients = useMemo(() => {
    const related = new Set(
      appointments
        .filter((a) => a.provider_id === provider.id || a.practitioner_id === provider.id)
        .map((a) => a.created_by_id)
        .filter(Boolean) as string[]
    );
    return patients
      .filter((p) => p.assigned_provider === provider.id || related.has(p.id))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "he"));
  }, [patients, appointments, provider.id]);

  const services = provider.consultation_types;
  const [patientId, setPatientId] = useState(bookablePatients[0]?.id ?? NEW_PATIENT);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [laneId, setLaneId] = useState(state.laneId ?? lanes[0]?.id ?? SELF_LANE);
  const lane = lanes.find((l) => l.id === laneId);
  // A unit's עמדה only performs the items linked to it; a lane with no links at
  // all can still take anything (the unmodelled fallback, see unit-resources).
  const laneServices = useMemo(() => {
    if (!isUnit || !lane || lane.serviceIds.length === 0) return services;
    const allowed = new Set(lane.serviceIds);
    return services.filter((s) => allowed.has(s.id));
  }, [isUnit, lane, services]);
  const [serviceId, setServiceId] = useState(laneServices[0]?.id ?? "");
  const service: ConsultationType | undefined =
    laneServices.find((s) => s.id === serviceId) ?? laneServices[0];
  const [date, setDate] = useState(state.date);
  const [time, setTime] = useState(minutesToTime(state.startMin));
  const [duration, setDuration] = useState(service?.duration_minutes || 30);
  const [clinicId, setClinicId] = useState(provider.clinic_locations[0]?.id ?? "");
  const [notes, setNotes] = useState("");

  // Picking an item re-seeds the duration — its configured length is the right
  // default, and a provider who wants otherwise just edits the field.
  function pickService(id: string) {
    setServiceId(id);
    const next = laneServices.find((s) => s.id === id);
    if (next?.duration_minutes) setDuration(next.duration_minutes);
  }

  const patient = patientId === NEW_PATIENT ? undefined : patients.find((p) => p.id === patientId);
  const clientName = patient?.full_name ?? newName.trim();
  const clientPhone = patient?.phone ?? (newPhone.trim() || undefined);

  const practitionerId = isUnit ? lane?.practitionerId : selfPractitionerId;
  const resourceId = isUnit && laneId !== SELF_LANE && laneId !== UNASSIGNED_LANE ? laneId : undefined;
  const startMin = timeToMinutes(time || "00:00");
  const conflict = useMemo(
    () =>
      findApptConflict(appointments, {
        contextId: provider.id,
        resourceId,
        practitionerId,
        date,
        startMin,
        durationMin: Math.max(15, duration || 15),
      }),
    [appointments, provider.id, resourceId, practitionerId, date, startMin, duration]
  );

  const priced = service
    ? resolvePriceBreakdown(service.prices, provider.agreements, patient ?? null, service.price_full)
    : null;
  const canSubmit = !!clientName && !!service && !!date && !!time && !conflict;

  // Booking outside your own shifts is allowed — squeezing someone in is a real
  // thing — but never silently: patients are not offered these hours.
  const outsideShift = useMemo(() => {
    if (!date || !time) return false;
    const bands = openBandsFor(laneId, date);
    return !isInsideBands(bands, startMin, startMin + Math.max(15, duration || 15));
  }, [openBandsFor, laneId, date, time, startMin, duration]);

  if (services.length === 0) {
    return (
      <p className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-text">
        אין עדיין פריטים בקטלוג, ולכן אי אפשר לקבוע תור. הוסיפו פריט בלשונית ‚פריטים ומחירים‘.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Select label="מטופל/ת" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
        {bookablePatients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name}
            {p.phone ? ` · ${p.phone}` : ""}
          </option>
        ))}
        <option value={NEW_PATIENT}>מטופל/ת חדש/ה…</option>
      </Select>

      {patientId === NEW_PATIENT && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="שם מלא" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <Input label="טלפון" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} dir="ltr" />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {isUnit && lanes.length > 0 && (
          <Select
            label="עמדה"
            value={laneId}
            onChange={(e) => {
              setLaneId(e.target.value);
              setServiceId("");
            }}
          >
            {lanes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.arrayName ? ` · ${l.arrayName}` : ""}
              </option>
            ))}
          </Select>
        )}
        <Select label="פריט" value={service?.id ?? ""} onChange={(e) => pickService(e.target.value)}>
          {laneServices.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        {!isUnit && provider.clinic_locations.length > 1 && (
          <Select label="מיקום" value={clinicId} onChange={(e) => setClinicId(e.target.value)}>
            {provider.clinic_locations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        <Input type="date" label="תאריך" value={date} onChange={(e) => setDate(e.target.value)} required />
        <Input type="time" label="שעה" value={time} onChange={(e) => setTime(e.target.value)} required />
        <Input
          type="number"
          min={15}
          step={5}
          label="משך (דקות)"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
      </div>

      <Textarea label="הערות" value={notes} onChange={(e) => setNotes(e.target.value)} />

      {laneServices.length === 0 && (
        <p className="rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning-text">
          לעמדה זו לא שויכו פריטים. שייכו פריטים לעמדה בלשונית ‚זמינות ולוח זמנים‘, או בחרו עמדה אחרת.
        </p>
      )}

      {outsideShift && !conflict && (
        <p className="flex items-start gap-1.5 rounded-lg bg-warning-bg px-3 py-2 text-xs leading-relaxed text-warning-text">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          השעה שנבחרה נמצאת מחוץ למשמרות שפתחת. אפשר לקבוע כאן תור ידנית, אך מטופלים לא רואים שעה זו כפנויה.
        </p>
      )}

      {conflict ? (
        <p className="rounded-lg bg-danger-bg px-3 py-2 text-xs leading-relaxed text-danger-text">
          {conflictMessage(conflict, {
            contextId: provider.id,
            resourceId,
            practitionerId,
            date,
            startMin,
            durationMin: duration,
          })}
        </p>
      ) : (
        priced && (
          <p className="flex items-center gap-1.5 rounded-lg bg-info-bg px-3 py-2 text-xs text-info-text">
            <Info className="h-3.5 w-3.5 shrink-0" />
            מחיר לפי שכבה {priced.layer}: {formatCurrency(priced.price)}
          </p>
        )
      )}

      <Button
        disabled={!canSubmit}
        onClick={() => {
          if (!service || !clientName) return;
          onCreate({
            client_name: clientName,
            client_phone: clientPhone,
            provider_id: provider.id,
            provider_name: provider.display_name,
            service_name: service.name,
            clinic_id: !isUnit ? clinicId || undefined : undefined,
            resource_id: resourceId,
            practitioner_id: practitionerId,
            date,
            time,
            duration_minutes: Math.max(15, duration || 15),
            // Booked by the provider inside their own diary — there's no deposit
            // flow here, so it starts confirmed rather than awaiting payment.
            status: "מאושר",
            price: priced?.price,
            kupah: patient?.kupah,
            notes: notes || undefined,
            created_by_id: patient?.id,
          });
        }}
      >
        <CalendarPlus className="h-4 w-4" /> קבע תור
      </Button>

      {!patient && (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Info className="h-3.5 w-3.5" />
          תור למטופל/ת שאינו/ה רשום/ה במערכת לא יקושר לתיק מטופל.
        </p>
      )}
    </div>
  );
}
