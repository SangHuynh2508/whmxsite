import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { cn } from '@/lib/utils';
import { BackToTop, Button, Notice, SkeletonRows } from '../layout/ui';
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
      <div className="flex flex-none flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-(--border-color) px-4 py-2.5 lg:px-5">
        <a href="#/admin/characters" className="text-[13px] text-(--text-muted) hover:text-(--text-main)">← Danh sách</a>
        <Avatar src={characterAvatar(id)} label={id} className="size-9 rounded-md" />
        <h2 className="min-w-0 truncate text-base font-semibold">
          {c?.nameVi.value || c?.nameCn || id}
          {c?.nameVi.value && <small lang="zh" className="admin-cn ml-1.5 font-normal text-(--text-muted)">{c.nameCn}</small>}
        </h2>
        <nav aria-label="Mục hồ sơ" className="flex gap-0.5 overflow-x-auto [scrollbar-width:none] max-lg:w-full lg:ml-6">
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
      <BackToTop className="lg:hidden" />{/* phones: the page scrolls, the panes don't */}
    </div>
  );
}
