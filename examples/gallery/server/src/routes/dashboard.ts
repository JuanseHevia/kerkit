import type { Request, Response } from 'express';
import {
  blockingDependencies,
  canComplete,
  checklistProgress,
  cycleProgress,
  getCopy,
  nextExpectedSession,
  resolveCareEventKind,
  totalSessions,
} from '@kerkit/core';
import type { CopyKey, Task } from '@kerkit/core';
import {
  demoCompletedSessions,
  demoLastSessionDate,
  demoTreatmentPlan,
} from '../treatment-plan.js';
import type { DemoDeps } from '../deps.js';

/**
 * GET /api/dashboard — the caretaker domain primitives at work: treatment cycle
 * progress, upcoming care events with their prep/authorization requirements, and
 * a checklist roll-up with dependency-aware completion. All from @kerkit/core
 * domain functions over the synthetic persona.
 */
export function dashboardRoute(deps: DemoDeps) {
  const { pack } = deps;
  const copy = (key: string) => getCopy(pack, key as CopyKey);

  return async (_req: Request, res: Response) => {
    const userId = deps.userId;
    const [appointments, institutions, authorizations, checklists, tasks] = await Promise.all([
      deps.repos.appointments.list({ userId }),
      deps.repos.profile.listInstitutions(),
      deps.repos.authorizations.list({ userId }),
      deps.repos.checklists.list({ userId }),
      deps.repos.tasks.list({ userId }),
    ]);

    const institutionName = new Map(institutions.map((i) => [i.id, i.name]));

    // --- Treatment progress (synthetic descriptive plan) ---
    const progress = cycleProgress(demoTreatmentPlan, demoCompletedSessions);
    const nextSession = nextExpectedSession(
      demoTreatmentPlan,
      demoCompletedSessions,
      demoLastSessionDate,
    );

    const treatment = {
      protocolLabel: demoTreatmentPlan.protocolLabel,
      totalSessions: totalSessions(demoTreatmentPlan),
      completedSessions: demoCompletedSessions,
      currentCycle: progress.cycle?.index ?? null,
      cycleCount: demoTreatmentPlan.cycles.length,
      sessionInCycle: progress.sessionInCycle,
      fraction: progress.fraction,
      lastSessionDate: demoLastSessionDate,
      nextSessionEstimate: nextSession,
    };

    // --- Upcoming care events with prep/authorization metadata ---
    const careEvents = appointments
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((appt) => {
        const meta = resolveCareEventKind(appt.type);
        const linkedAuth = authorizations.find((z) => z.linkedAppointmentId === appt.id) ?? null;
        return {
          id: appt.id,
          title: appt.title,
          type: appt.type,
          kindLabel: copy(meta.labelKey),
          date: appt.date,
          status: appt.status,
          institution: institutionName.get(appt.institutionId) ?? null,
          locationDetail: appt.locationDetail ?? null,
          requiresAuthorization: meta.requiresAuthorization,
          requiresPrep: meta.requiresPrep,
          generatesResultDocument: meta.generatesResultDocument,
          typicalDurationMinutes: meta.typicalDurationMinutes ?? null,
          authorization: linkedAuth
            ? {
                status: linkedAuth.status,
                statusLabel: copy(`status.authorization.badge.${linkedAuth.status}`),
                description: linkedAuth.description,
              }
            : null,
        };
      });

    // --- Checklist roll-up with dependency-aware completion ---
    const byId = new Map<string, Pick<Task, 'status'>>(tasks.map((t) => [t.id, { status: t.status }]));
    const checklist = checklists[0] ?? null;
    const checklistTasks = checklist
      ? tasks.filter((t) => t.checklistId === checklist.id)
      : [];
    const taskRows = checklistTasks
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((t) => ({
        id: t.id,
        title: t.title,
        kind: t.kind,
        kindLabel: copy(`taskKind.${t.kind}`),
        status: t.status,
        statusLabel: copy(`status.task.${t.status}`),
        dueDate: t.dueDate ?? null,
        dependsOn: t.dependsOn ?? [],
        blocking: blockingDependencies(t, byId),
        canComplete: canComplete(t, byId),
      }));

    res.json({
      treatment,
      careEvents,
      checklist: checklist
        ? {
            title: checklist.title,
            kind: checklist.kind,
            progress: checklistProgress(checklistTasks),
            tasks: taskRows,
          }
        : null,
    });
  };
}
