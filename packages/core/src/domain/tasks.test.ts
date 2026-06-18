import { describe, expect, it } from 'vitest';
import type { Task, TaskStatus } from '../entities/task.js';
import { blockingDependencies, canComplete, checklistProgress } from './tasks.js';

const byStatus = (...statuses: TaskStatus[]) => statuses.map((status) => ({ status }));

const dep = (id: string, status: TaskStatus): [string, Pick<Task, 'status'>] => [id, { status }];

describe('checklistProgress', () => {
  it('reports fractional completion', () => {
    expect(checklistProgress(byStatus('done', 'done', 'todo', 'blocked'))).toEqual({
      total: 4,
      done: 2,
      fraction: 0.5,
      complete: false,
    });
  });

  it('is complete only when every task is done', () => {
    expect(checklistProgress(byStatus('done', 'done')).complete).toBe(true);
    // a cancelled task is not "done", so the checklist is not complete
    expect(checklistProgress(byStatus('done', 'cancelled')).complete).toBe(false);
  });

  it('treats an empty checklist as complete with fraction 1', () => {
    expect(checklistProgress([])).toEqual({ total: 0, done: 0, fraction: 1, complete: false });
  });
});

describe('task dependencies', () => {
  it('blocks completion until dependencies are settled (lab before consult)', () => {
    const lab = '00000000-0000-4000-8000-0000000000a1';
    const consult: Pick<Task, 'dependsOn'> = { dependsOn: [lab] };

    const pending = new Map([dep(lab, 'in_progress')]);
    expect(canComplete(consult, pending)).toBe(false);
    expect(blockingDependencies(consult, pending)).toEqual([lab]);

    const finished = new Map([dep(lab, 'done')]);
    expect(canComplete(consult, finished)).toBe(true);
    expect(blockingDependencies(consult, finished)).toEqual([]);
  });

  it('treats a cancelled dependency as satisfied', () => {
    const id = '00000000-0000-4000-8000-0000000000b2';
    expect(canComplete({ dependsOn: [id] }, new Map([dep(id, 'cancelled')]))).toBe(true);
  });

  it('treats a missing dependency as blocking', () => {
    expect(canComplete({ dependsOn: ['ghost'] }, new Map())).toBe(false);
  });

  it('a task with no dependencies can always complete', () => {
    expect(canComplete({}, new Map())).toBe(true);
  });
});
