'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Box } from '@/components/Blueprint';
import { describeError } from '@/lib/errors';
import { hashPin, isValidPin, isValidUsername, newSalt, newUuid } from '@/lib/pin';
import type { Driver } from '@/lib/types';
import { km, fmtDay } from '@/lib/format';

type Stats = Record<string, { trips: number; meters: number }>;

type Draft = {
  mode: 'create' | 'edit';
  uuid?: string;
  username: string;
  role: string;
  active: boolean;
  pin: string;
  confirm: string;
};

const emptyDraft = (): Draft => ({
  mode: 'create',
  username: '',
  role: 'driver',
  active: true,
  pin: '',
  confirm: '',
});

export function DriversManager({
  initial,
  stats,
  ownerId,
}: {
  initial: Driver[];
  stats: Stats;
  ownerId: string;
}) {
  const router = useRouter();
  const [drivers, setDrivers] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const { data } = await createClient()
      .from('app_users')
      .select('*')
      .order('username');
    if (data) setDrivers(data as Driver[]);
    router.refresh();
  }

  async function save() {
    if (!draft) return;
    const name = draft.username.trim();

    if (!isValidUsername(name)) {
      setError('Usernames are 3–20 characters: letters, numbers, . _ or -');
      return;
    }
    // A PIN is required when creating; on edit, blank means "leave it alone".
    const changingPin = draft.mode === 'create' || draft.pin.length > 0;
    if (changingPin) {
      if (!isValidPin(draft.pin)) {
        setError('The PIN must be exactly 4 digits.');
        return;
      }
      if (draft.pin !== draft.confirm) {
        setError('The two PINs do not match.');
        return;
      }
    }
    // Guard the last admin before writing, not after.
    if (draft.mode === 'edit') {
      const before = drivers.find((d) => d.uuid === draft.uuid);
      const admins = drivers.filter((d) => d.role === 'admin' && d.active);
      const losingLastAdmin =
        before?.role === 'admin' &&
        admins.length <= 1 &&
        (draft.role !== 'admin' || !draft.active);
      if (losingLastAdmin) {
        setError('There must be at least one active admin.');
        return;
      }
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const now = new Date().toISOString();

    try {
      const row: Record<string, unknown> = {
        owner_id: ownerId,
        username: name,
        role: draft.role,
        active: draft.active,
        updated_at: now,
      };
      if (changingPin) {
        const salt = newSalt();
        row.pin_salt = salt;
        row.pin_hash = await hashPin(draft.pin, salt);
      }

      if (draft.mode === 'create') {
        row.uuid = newUuid();
        row.created_at = now;
        const { error } = await supabase.from('app_users').insert(row);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_users')
          .update(row)
          .eq('uuid', draft.uuid!);
        if (error) throw error;
      }

      setDraft(null);
      await reload();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(driver: Driver) {
    const s = stats[driver.uuid];
    if (s && s.trips > 0) {
      setError(
        `${driver.username} has ${s.trips} recorded journey${s.trips === 1 ? '' : 's'}. ` +
          'Deactivate instead so the records stay attributed.',
      );
      return;
    }
    const admins = drivers.filter((d) => d.role === 'admin' && d.active);
    if (driver.role === 'admin' && admins.length <= 1) {
      setError('Cannot remove the only admin.');
      return;
    }
    if (!confirm(`Remove ${driver.username}? They will no longer be able to sign in.`)) {
      return;
    }

    setBusy(true);
    const { error } = await createClient()
      .from('app_users')
      .delete()
      .eq('uuid', driver.uuid);
    setBusy(false);
    if (error) {
      setError(describeError(error));
      return;
    }
    await reload();
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <p className="muted" style={{ fontSize: 13.5, maxWidth: 620, flex: 1 }}>
          Changes made here reach the phones on their next sync. A new driver can
          sign in with their username and PIN once their handset has synced.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => {
            setError(null);
            setDraft(emptyDraft());
          }}
        >
          Add driver
        </button>
      </div>

      {error && (
        <Box style={{ borderColor: 'var(--danger)', marginBottom: 14 }}>
          <span style={{ fontSize: 13.5, color: 'var(--danger)' }}>{error}</span>
        </Box>
      )}

      {draft && (
        <Box style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 12 }}>
            {draft.mode === 'create' ? 'Add driver' : `Edit ${draft.username}`}
          </h3>
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
          >
            <div>
              <label className="muted" style={{ fontSize: 12 }}>USERNAME</label>
              <input
                className="input"
                style={{ marginTop: 4 }}
                value={draft.username}
                onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                placeholder="driver1"
                autoFocus
              />
            </div>
            <div>
              <label className="muted" style={{ fontSize: 12 }}>ROLE</label>
              <select
                className="input"
                style={{ marginTop: 4 }}
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              >
                <option value="driver">Driver</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="muted" style={{ fontSize: 12 }}>STATUS</label>
              <select
                className="input"
                style={{ marginTop: 4 }}
                value={draft.active ? 'active' : 'disabled'}
                onChange={(e) => setDraft({ ...draft, active: e.target.value === 'active' })}
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div>
              <label className="muted" style={{ fontSize: 12 }}>
                {draft.mode === 'create' ? '4-DIGIT PIN' : 'NEW PIN (optional)'}
              </label>
              <input
                className="input"
                style={{ marginTop: 4 }}
                value={draft.pin}
                inputMode="numeric"
                maxLength={4}
                onChange={(e) =>
                  setDraft({ ...draft, pin: e.target.value.replace(/\D/g, '') })
                }
                placeholder="1234"
              />
            </div>
            <div>
              <label className="muted" style={{ fontSize: 12 }}>CONFIRM PIN</label>
              <input
                className="input"
                style={{ marginTop: 4 }}
                value={draft.confirm}
                inputMode="numeric"
                maxLength={4}
                onChange={(e) =>
                  setDraft({ ...draft, confirm: e.target.value.replace(/\D/g, '') })
                }
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : draft.mode === 'create' ? 'Create driver' : 'Save changes'}
            </button>
            <button className="btn" onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </Box>
      )}

      {drivers.length === 0 ? (
        <Box>
          <p className="muted" style={{ fontSize: 14 }}>
            No drivers yet. Add one above, or let a phone sync its roster up.
          </p>
        </Box>
      ) : (
        <Box style={{ padding: 0 }}>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th style={{ textAlign: 'right' }}>Journeys</th>
                  <th style={{ textAlign: 'right' }}>Distance</th>
                  <th style={{ textAlign: 'right' }}>Manage</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => {
                  const s = stats[d.uuid] ?? { trips: 0, meters: 0 };
                  return (
                    <tr key={d.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              background:
                                d.role === 'admin' ? 'var(--accent)' : 'var(--neutral-400)',
                              color: 'var(--bg)',
                              display: 'grid',
                              placeItems: 'center',
                              fontFamily: 'var(--font-heading)',
                              fontWeight: 600,
                              opacity: d.active ? 1 : 0.5,
                            }}
                          >
                            {d.username.slice(0, 1).toUpperCase()}
                          </div>
                          <strong style={{ fontFamily: 'var(--font-heading)', fontSize: 16 }}>
                            {d.username}
                          </strong>
                        </div>
                      </td>
                      <td>{d.role === 'admin' ? 'Admin' : 'Driver'}</td>
                      <td>
                        <span className={d.active ? 'tag' : 'tag tag-muted'}>
                          {d.active ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </td>
                      <td className="muted">{fmtDay(d.created_at)}</td>
                      <td className="metric" style={{ textAlign: 'right' }}>{s.trips}</td>
                      <td className="metric" style={{ textAlign: 'right' }}>{km(s.meters)} km</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="btn"
                          style={{ padding: '4px 10px', fontSize: 12.5 }}
                          onClick={() => {
                            setError(null);
                            setDraft({
                              mode: 'edit',
                              uuid: d.uuid,
                              username: d.username,
                              role: d.role,
                              active: d.active,
                              pin: '',
                              confirm: '',
                            });
                          }}
                        >
                          Edit
                        </button>{' '}
                        <button
                          className="btn"
                          style={{ padding: '4px 10px', fontSize: 12.5, color: 'var(--danger)' }}
                          onClick={() => remove(d)}
                          disabled={busy}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Box>
      )}
    </>
  );
}
