import { beforeEach, describe, expect, it } from 'vitest';
import { MockBackend } from '@/mocks/backend';

const clock = Date.parse('2026-03-01T12:00:00Z');
const make = () => new MockBackend({ persist: true, now: () => clock, random: () => 0.99 });
const user = { username: 'demo', role: 'user' as const };

beforeEach(() => sessionStorage.clear());

describe('mock backend: surviving a page reload', () => {
  it('a new backend finds the scans the old one created, and does not seed the history twice', () => {
    const first = make();
    const created = first.createScan(
      { projectId: 'my-app', scanType: 'DAST', targetId: 'juice-shop' },
      user,
    );
    if (!created.ok) throw new Error('could not create a job');
    const seededCount = first.listScans('demo-app', 50, null);

    const afterReload = make();

    expect(afterReload.getScan(created.value.jobId)).toMatchObject({
      projectId: 'my-app',
      status: 'CREATED',
    });
    const seededAgain = afterReload.listScans('demo-app', 50, null);
    expect(seededAgain.ok && seededAgain.value.items).toHaveLength(
      seededCount.ok ? seededCount.value.items.length : -1,
    );
  });

  it('keeps a started scan on its way through its stages', () => {
    const first = make();
    const created = first.createScan(
      { projectId: 'my-app', scanType: 'DAST', targetId: 'juice-shop' },
      user,
    );
    if (!created.ok) throw new Error('could not create a job');
    first.startScan(created.value.jobId);

    expect(make().getScan(created.value.jobId)).toMatchObject({ status: 'QUEUED' });
  });

  it('keeps the findings too', () => {
    const first = new MockBackend({ persist: true, now: () => clock, random: () => 0.99 });
    const before = first.getFindings('demo-app', 'SAST');
    expect(before.length).toBeGreaterThan(0);

    expect(make().getFindings('demo-app', 'SAST')).toEqual(before);
  });

  it('starts fresh, with the seeded history, when nothing is saved or the saved data is damaged', () => {
    sessionStorage.setItem('ush-mock-backend-v1', '{broken');
    const backend = make();
    const history = backend.listScans('demo-app', 50, null);
    expect(history.ok && history.value.items.length).toBeGreaterThan(0);
  });

  it('forgets everything when persistence is off', () => {
    const first = new MockBackend({ persist: false, now: () => clock, random: () => 0.99 });
    const created = first.createScan(
      { projectId: 'my-app', scanType: 'DAST', targetId: 'juice-shop' },
      user,
    );
    if (!created.ok) throw new Error('could not create a job');

    expect(
      new MockBackend({ persist: false, now: () => clock, random: () => 0.99 }).getScan(
        created.value.jobId,
      ),
    ).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
