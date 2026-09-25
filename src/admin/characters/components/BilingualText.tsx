import { useState } from 'react';
import { PairRow, ViCell } from './Pair';
import { FullscreenEditor } from './FullscreenEditor';

export type LoreStatus = 'todo' | 'legacy' | 'changed' | 'done';
type Props = { unitKey: string; label: string; extra?: string; cn: string; previousCn: string | null; value: string; status: LoreStatus; dirty: boolean; confirmed: boolean; onChange: (v: string) => void; onConfirm: () => void };

export function BilingualText({ unitKey, label, extra, cn, previousCn, value, status, dirty, confirmed, onChange, onConfirm }: Props) {
  const [showOld, setShowOld] = useState(false);
  const [full, setFull] = useState(false);
  const long = cn.length > 200;
  return (
    <PairRow id={unitKey} label={label} extra={extra} original={showOld && previousCn ? <><span className="mb-1 block text-xs text-(--rarity-ssr-text)">Tiếng Trung trước đây</span>{previousCn}</> : cn}>
      <ViCell id={unitKey} value={value} dirty={dirty} multiline={long} placeholder="Viết bản tiếng Việt…" onChange={onChange} notes={<>
        {status === 'todo' && !value.trim() && <span>Chưa dịch</span>}
        {status === 'legacy' && <><span className="text-(--accent)">Bản cũ · chưa lưu</span>{!confirmed && <button type="button" onClick={onConfirm} className="hover:text-(--text-main)">Dùng bản này</button>}</>}
        {status === 'changed' && <><span className="text-(--rarity-ssr-text)">Tiếng Trung đã đổi</span>{previousCn && <button type="button" onClick={() => setShowOld((v) => !v)} className="hover:text-(--text-main)">{showOld ? 'Xem bản mới' : 'So bản cũ'}</button>}{!confirmed && <button type="button" onClick={onConfirm} className="hover:text-(--text-main)">Giữ bản dịch</button>}</>}
        {confirmed && <span className="text-(--accent)">Sẽ lưu thành bản chính thức</span>}
        {long && <button type="button" onClick={() => setFull(true)} className="hover:text-(--text-main)">Phóng to</button>}
        <span className="ml-auto tabular-nums">{value.length} ký tự</span>
      </>} />
      {full && <FullscreenEditor label={label} original={cn} value={value} onChange={onChange} onClose={() => setFull(false)} />}
    </PairRow>
  );
}
