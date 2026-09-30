// One Khí Giả card in the catalogue (docs/public-redesign/catalog-card/direction-approved.md, option 3 "Không khung"):
// the game's 1 : 2 card art, the game's rarity glow at its foot (ui_ty_kp_pz_<rare>), the job icon where the game shows
// Trí Tri, the name under the art. Limited is the 限 seal already printed in the art (all 11 is_limited cards, checked),
// so there is no red border and no "SSR" label; rarity, job and Limited stay in the accessible name.
export type CatalogCard = {
  slug: string; name: string; rare: number; rarityLabel: string; job: number; jobLabel: string; limited: boolean;
  primary: string; secondary: string | null; huanzhangIcon: string | null;
};

/** The game's rarity glow and the job icon over a card's art — shared by the catalogue, the Tổng quan tab and the
 *  calculator panel (each wraps them in a `.cc-art` box with the card image). */
export function cardArtLayers(rare: number, job: number): string {
  return `<span class="cc-glow" style="background-image:url(/assets/frames/ui_ty_kp_pz_${rare}.png)"></span>`
    + `<img class="cc-job" src="/assets/jobs/job_${job}.png" alt="" />`;
}

export function catalogCardHtml(c: CatalogCard): string {
  const label = [c.name, c.jobLabel, c.rarityLabel, c.limited ? 'Limited' : ''].filter(Boolean).join(' · ');
  return `<a href="#/characters/${c.slug}" class="cc-card${c.secondary ? ' has-alt' : ''} card-result-reveal" aria-label="${label}" title="${label}">`
    + '<span class="cc-art">'
    + `<img class="cc-art-main" src="${c.primary}" alt="" loading="lazy" />`
    + (c.secondary ? `<img class="cc-art-alt" src="${c.secondary}" alt="" loading="lazy" onerror="this.remove()" />` : '')
    + cardArtLayers(c.rare, c.job)
    + (c.huanzhangIcon ? `<img class="cc-hz" src="${c.huanzhangIcon}" alt="" title="Có Hoán Chương" onerror="this.remove()" />` : '')
    + `</span><span class="cc-name">${c.name}</span></a>`;
}
