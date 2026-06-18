import type { Task, TaskStatus } from '../entities/task.js';

/** Roll-up completion for a checklist's tasks. */
export interface ChecklistProgress {
  total: number;
  done: number;
  /** 0..1; 1 when every task is done (or the checklist is empty). */
  fraction: number;
  /** True when there are tasks and all are done. */
  complete: boolean;
}

/** A "done" task is finished or no longer required. */
const SETTLED: ReadonlySet<TaskStatus> = new Set<TaskStatus>(['done', 'cancelled']);

export function checklistProgress(tasks: readonly Pick<Task, 'status'>[]): ChecklistProgress {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const fraction = total === 0 ? 1 : done / total;
  return { total, done, fraction, complete: total > 0 && done === total };
}

/**
 * Ids of the dependencies still blocking a task — those not yet settled
 * (neither done nor cancelled). A missing dependency is treated as blocking,
 * since we can't prove it's complete.
 */
export function blockingDependencies(
  task: Pick<Task, 'dependsOn'>,
  byId: ReadonlyMap<string, Pick<Task, 'status'>>,
): string[] {
  return (task.dependsOn ?? []).filter((id) => {
    const dep = byId.get(id);
    return !dep || !SETTLED.has(dep.status);
  });
}

/** Whether a task's dependencies are all satisfied, so it may move to `done`. */
export function canComplete(
  task: Pick<Task, 'dependsOn'>,
  byId: ReadonlyMap<string, Pick<Task, 'status'>>,
): boolean {
  return blockingDependencies(task, byId).length === 0;
}
