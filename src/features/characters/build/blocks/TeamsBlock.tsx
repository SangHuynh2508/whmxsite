import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Block } from '../Block';
import type { BuildView } from '../buildView.mts';
import { teamSpan, type Span } from '../sheetLayout.mts';

const PHONE = '(max-width: 640px)';
const SHOWN_ON_PHONE = 4;

function usePhone() {
  const [phone, setPhone] = useState(() => matchMedia(PHONE).matches);
  useEffect(() => {
    const query = matchMedia(PHONE);
    const onChange = () => setPhone(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return phone;
}

// Packed grid: a track ≈ one avatar, each group spans what it needs, `dense` backfills the gaps. On phones only the
// first 4 groups show until "Xem thêm" (critique P2: the team list took ~1000 px at 390).
export function TeamsBlock({ teams, teamOther, span, action }: { teams: BuildView['teams']; teamOther: string; span: Span; action?: ReactNode }) {
  const phone = usePhone();
  const [all, setAll] = useState(false);
  const shown = phone && !all ? teams.slice(0, SHOWN_ON_PHONE) : teams;
  return (
    <Block id="teams" title="Đội hình" span={span} action={action}>
      {shown.length > 0 && (
        <div className="bs-pack">
          {shown.map((t, i) => (
            <div key={i} className="bs-team" style={{ '--n': teamSpan(t), '--n-phone': Math.min(teamSpan(t), 4) } as CSSProperties}>
              {t.label && <h4>{t.label}</h4>}
              <div className="bs-members">{t.members.map((m) => <a key={m.id} href={m.href}>{m.icon && <img src={m.icon} alt="" />}<span>{m.name}</span></a>)}</div>
              {t.note && <p>{t.note}</p>}
            </div>
          ))}
        </div>
      )}
      {shown.length < teams.length && <button type="button" className="bs-more" onClick={() => setAll(true)}>Xem thêm {teams.length - shown.length} nhóm</button>}
      {teamOther && <p className="bs-note">Khác: {teamOther}</p>}
    </Block>
  );
}
