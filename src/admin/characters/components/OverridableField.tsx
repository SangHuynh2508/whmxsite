import { useId } from 'react';
import { PairRow, ViCell } from './Pair';

type Props = {
  label: string;
  original: string | null | undefined; // read-only CN (left page)
  sourceVi: string | null | undefined; // workbook VI the field falls back to
  override: string | null | undefined; // active admin override, null when none
  value: string;
  dirty: boolean;
  onChange: (value: string) => void;
  onRevert: () => void;
  multiline?: boolean;
};

// Sticky column captions above a list of pairs (desktop only; phones stack the pair).
export function PairHead() {
  return (
    <div className="sticky top-0 z-[2] grid grid-cols-2 gap-12 border-b border-(--border-color) bg-(--bg-main) px-8 py-2.5 text-[11px] uppercase tracking-[.3em] text-(--text-subtle) max-md:hidden">
      <span>Nguyên bản</span>
      <span>Tiếng Việt</span>
    </div>
  );
}

// A source-backed field (character/skin): CN left, VI override right, "Trả về gốc" when overridden.
export function OverridableField({ label, original, sourceVi, override, value, dirty, onChange, onRevert, multiline }: Props) {
  const id = useId();
  const empty = value.trim() === '';
  return (
    <PairRow id={id} label={label} original={original}>
      <ViCell id={id} value={value} dirty={dirty} multiline={multiline} onChange={onChange}
        placeholder={sourceVi ? `Để trống = dùng bản gốc: ${sourceVi}` : 'Viết bản tiếng Việt…'}
        notes={<>
          {override != null && !empty && (
            <>
              <span className="text-(--accent)">Đang dùng bản sửa</span>
              {sourceVi && <span className="min-w-0 truncate">Gốc: {sourceVi}</span>}
              <button type="button" onClick={onRevert} className="transition-colors hover:text-(--text-main)">Trả về gốc</button>
            </>
          )}
          {empty && !sourceVi && <span>Chưa dịch</span>}
          <span className="ml-auto tabular-nums">{value.length} ký tự</span>
        </>} />
    </PairRow>
  );
}
