import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { Lock, Plus } from 'lucide-react';
import { ROLES, listUsers, provisionUser } from './usersApi.js';
import { Button, Field, Notice, SkeletonRows, ViewHeader, inputClass } from '@/ui';

type User = { name: string; email: string; role: string; status: string };

const ROLE_NOTE: Record<string, string> = {
  editor: 'Biên tập metadata và tải ảnh ứng viên.',
  owner: 'Toàn quyền, gồm vòng đời, hiển thị, kích hoạt ảnh và cấp tài khoản.',
};
const STATUS_VI: Record<string, string> = { active: 'Đang hoạt động' };

export default function AccountsView({ isOwner }: { isOwner: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewHeader title="Tài khoản" meta="Quản trị" />
      <div className="min-h-0 flex-1 bg-(--bg-surface) lg:overflow-y-auto">
        <div className="mx-auto w-full max-w-[760px] px-4 py-10 lg:px-6 lg:py-14">
          {isOwner ? <Accounts /> : <OwnerOnly />}
        </div>
      </div>
    </div>
  );
}

function OwnerOnly() {
  return (
    <div className="grid justify-items-start gap-3">
      <Lock size={20} aria-hidden className="text-(--text-muted)" />
      <h2 className="admin-serif text-2xl font-semibold text-(--text-main)">Chỉ dành cho owner</h2>
      <p className="max-w-[56ch] text-sm leading-6 text-(--text-muted)">
        Phiên đăng nhập của bạn hợp lệ, nhưng việc xem và cấp tài khoản chỉ dành cho owner. Hãy liên hệ owner nếu cần thêm người vào sổ quản trị.
      </p>
    </div>
  );
}

function Accounts() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [done, setDone] = useState('');

  const load = useCallback(async () => {
    setFailed(false);
    const list: User[] | null = await listUsers();
    if (list) setUsers(list);
    else setFailed(true);
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="admin-serif text-2xl font-semibold text-(--text-main)">Thành viên</h2>
          <p className="mt-1 text-sm text-(--text-muted)">Ai được vào sổ quản trị, với vai trò gì. Việc cấp tài khoản hiếm khi cần.</p>
        </div>
        {!formOpen && <Button onClick={() => { setFormOpen(true); setDone(''); }}><Plus size={15} aria-hidden /> Cấp tài khoản</Button>}
      </div>

      {done && <p role="status" className="mt-6 text-sm text-(--admin-gold-ink)">{done}</p>}
      {formOpen && (
        <ProvisionForm
          onCancel={() => setFormOpen(false)}
          onDone={async (name) => { setFormOpen(false); setDone(`Đã cấp tài khoản cho ${name}.`); await load(); }}
        />
      )}

      <div className="mt-8 border-t border-(--border-color)">
        {failed ? (
          <div className="grid justify-items-start gap-3 py-6">
            <Notice>Không thể tải tài khoản.</Notice>
            <Button onClick={() => void load()}>Thử lại</Button>
          </div>
        ) : !users ? (
          <SkeletonRows count={4} className="px-0" />
        ) : !users.length ? (
          <p className="py-6 text-sm text-(--text-muted)">Chưa có tài khoản nào.</p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Danh sách tài khoản</caption>
            <thead>
              <tr className="text-xs text-(--text-muted)">
                <th scope="col" className="py-2 pr-4 text-left font-medium">Tên</th>
                <th scope="col" className="py-2 pr-4 text-left font-medium max-sm:hidden">Email</th>
                <th scope="col" className="py-2 pr-4 text-left font-medium">Vai trò</th>
                <th scope="col" className="py-2 text-right font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.email} className="border-t border-(--border-color)">
                  <td className="py-3 pr-4 align-top">
                    <span className="font-medium text-(--text-main)">{user.name}</span>
                    <span className="block break-all text-xs text-(--text-muted) sm:hidden">{user.email}</span>
                  </td>
                  <td className="break-all py-3 pr-4 align-top text-(--text-muted) max-sm:hidden">{user.email}</td>
                  <td className="py-3 pr-4 align-top capitalize text-(--text-main)">{user.role}</td>
                  <td className="py-3 text-right align-top text-(--text-muted)">{STATUS_VI[user.status] ?? user.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function ProvisionForm({ onCancel, onDone }: { onCancel: () => void; onDone: (name: string) => Promise<void> }) {
  const id = useId();
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    setBusy(true);
    const failure: string | null = await provisionUser(values).catch(() => 'NETWORK_ERROR');
    setBusy(false);
    if (failure) { setError(`Không thể cấp tài khoản (${failure}).`); return; }
    await onDone(values.name);
  }

  return (
    <form onSubmit={submit} aria-labelledby={`${id}-t`} className="mt-6 grid gap-5 rounded-lg border border-(--border-strong) bg-(--bg-main) p-5">
      <h3 id={`${id}-t`} className="text-sm font-semibold text-(--text-main)">Cấp tài khoản mới</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tên hiển thị"><input required name="name" maxLength={200} className={`${inputClass} h-9`} /></Field>
        <Field label="Email"><input required name="email" type="email" maxLength={320} autoComplete="off" className={`${inputClass} h-9`} /></Field>
        <Field label="Mật khẩu tạm thời" hint="Tối thiểu 12 ký tự. Gửi riêng cho người nhận." className="sm:col-span-2">
          <input required name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" className={`${inputClass} h-9`} />
        </Field>
      </div>
      <fieldset className="grid gap-2 border-0 p-0">
        <legend className="mb-2 text-[13px] font-medium text-(--text-muted)">Vai trò</legend>
        {ROLES.map((item) => (
          <label key={item} className="flex cursor-pointer items-start gap-3 rounded-md border border-(--border-color) px-3 py-2.5 has-[:checked]:border-(--accent) has-[:checked]:bg-(--admin-gold-bg) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-(--accent)">
            <input type="radio" name="role" value={item} checked={role === item} onChange={() => setRole(item)} className="mt-1 accent-(--accent)" />
            <span>
              <span className="block text-sm font-medium capitalize text-(--text-main)">{item}</span>
              <span className="block text-xs text-(--text-muted)">{ROLE_NOTE[item]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error && <Notice>{error}</Notice>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Huỷ</Button>
        <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Đang cấp…' : 'Cấp tài khoản'}</Button>
      </div>
    </form>
  );
}
