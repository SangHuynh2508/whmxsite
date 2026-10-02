// One Khí Giả as a square game portrait with the game's rarity glow (ui_ty_kp_pz_<rare>) and optional badges in the
// bottom-right corner (direction D3, docs/public-redesign/tier-list/direction-approved.md). Domain-neutral so the Khí Giả
// catalogue or a team list can reuse it when they move to React; not in shared/ until a second real use.
import '../styles/characterTile.css';

export type CharacterTileProps = {
  name: string; untranslated: boolean; avatar: string; rare: number; href?: string; label: string;
  badges?: string[]; badgeTitle?: string; flipId?: string;
};

export function CharacterTile({ name, untranslated, avatar, rare, href, label, badges = [], badgeTitle, flipId }: CharacterTileProps) {
  const body = (
    <>
      <span className="ctile-art">
        <img src={avatar} alt="" loading="lazy" />
        <span className="ctile-glow" style={{ backgroundImage: `url(/assets/frames/ui_ty_kp_pz_${rare}.png)` }} />
        {badges.length > 0 && (
          <span className="ctile-badges" title={badgeTitle}>
            {badges.map((b) => <span key={b} className={b === 'HC' ? 'tl-badge hc' : 'tl-badge'}>{b}</span>)}
          </span>
        )}
      </span>
      <span className={untranslated ? 'ctile-name ctile-cn' : 'ctile-name'} lang={untranslated ? 'zh' : undefined}>{name}</span>
    </>
  );
  return href
    ? <a className="ctile" href={href} aria-label={label} data-flip-id={flipId}>{body}</a>
    : <span className="ctile" aria-label={label} data-flip-id={flipId}>{body}</span>;
}
