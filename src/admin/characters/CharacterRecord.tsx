import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BackToTop, Button, Notice, Select, SkeletonRows } from '../layout/ui';
import { getCharacter } from './charactersApi.js';
import { recordHref, type ModuleId } from './lib/route.mts';
import { Avatar, characterAvatar } from './components/Avatar';
import { OverviewModule } from './modules/OverviewModule';
import { LoreModule } from './modules/LoreModule';
import { BuildModule } from './modules/BuildModule';
import { SkinsModule } from './modules/SkinsModule';
import { SourceModule } from './modules/SourceModule';
import { HistoryModule } from './modules/HistoryModule';
import type { CharacterData, ModuleProps } from './types';

const TeaModule = (props: ModuleProps) => <LoreModule {...props} scope="tea" />;

// One entry per module; phase 2 adds Lore here.
export const MODULES: { id: ModuleId; label: string; Component: ComponentType<ModuleProps> }[] = [
  { id: 'overview', label: 'Tổng quan', Component: OverviewModule },
  { id: 'lore', label: 'Lore', Component: LoreModule },
  { id: 'tea', label: 'Phòng trà', Component: TeaModule },
  { id: 'build', label: 'Build', Component: BuildModule },
  { id: 'skins', label: 'Trang phục', Component: SkinsModule },
  { id: 'source', label: 'Nguồn', Component: SourceModule },
  { id: 'history', label: 'Lịch sử', Component: HistoryModule },
];

// Direction B: header strip (avatar, names, module tabs) above the module's own panes.
export function CharacterRecord({ id, module }: { id: string; module: ModuleId }) {
  const [data, setData] = useState<CharacterData | null>(null);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    const next: CharacterData = await getCharacter(id);
    setData(next);
    return next.character;
  }, [id]);
  const load = () => { setError(false); reload().catch(() => setError(true)); };
  useEffect(load, [reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = MODULES.find((m) => m.id === module) ?? MODULES[0];
  const c = data?.character;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Phones: one sticky 56 px row (back, avatar, name, module picker); LoreModule's unit bar sticks under it (top-14). */}
      <div className="flex flex-none flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-(--border-color) px-4 py-2.5 max-md:sticky max-md:top-0 max-md:z-20 max-md:h-14 max-md:flex-nowrap max-md:gap-x-2 max-md:bg-(--bg-main) max-md:py-0 max-md:pl-1 lg:px-5">
        <a href="#/admin/characters" aria-label="Danh sách" className="text-[13px] text-(--text-muted) hover:text-(--text-main) max-md:grid max-md:size-11 max-md:flex-none max-md:place-items-center">
          <ChevronLeft size={20} aria-hidden className="md:hidden" /><span aria-hidden className="max-md:hidden">← Danh sách</span>
        </a>
        <Avatar src={characterAvatar(id)} label={id} className="size-9 flex-none rounded-md max-md:size-8" />
        <h2 className="min-w-0 truncate text-base font-semibold max-md:flex-1">
          {c?.nameVi.value || c?.nameCn || id}
          {c?.nameVi.value && <small lang="zh" className="admin-cn ml-1.5 font-normal text-(--text-muted) max-md:hidden">{c.nameCn}</small>}
        </h2>
        <Select aria-label="Mục hồ sơ" value={active.id} onChange={(event) => { location.hash = recordHref(id, event.target.value as ModuleId); }}
          className="w-32 flex-none md:hidden [&_select]:h-11">
          {MODULES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </Select>
        <nav aria-label="Mục hồ sơ" className="flex gap-0.5 overflow-x-auto [scrollbar-width:none] max-md:hidden max-lg:w-full lg:ml-6">
          {MODULES.map((m) => (
            <a
              key={m.id}
              href={recordHref(id, m.id)}
              aria-current={m.id === active.id ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] transition-colors duration-(--motion-fast)',
                m.id === active.id ? 'bg-(--bg-elevated) text-(--text-main) shadow-[inset_0_-2px_0_var(--accent)]' : 'text-(--text-muted) hover:text-(--text-main)',
              )}
            >
              {m.label}
            </a>
          ))}
        </nav>
      </div>
      {error && <Notice className="m-4">Không tải được hồ sơ {id}. <Button variant="ghost" onClick={load}>Thử lại</Button></Notice>}
      {!data && !error && <SkeletonRows />}
      {data && <active.Component key={active.id} data={data} reload={reload} />}
      {/* md–lg: the page scrolls, the panes don't. Phones: hidden, it sat on the fields; Lore and Build have jump bars. */}
      <BackToTop className="max-md:hidden lg:hidden" />
    </div>
  );
}
