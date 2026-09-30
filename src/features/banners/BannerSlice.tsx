// One banner as a thin slice of its art (docs/public-redesign/home/direction-approved.md): the game's pool background,
// the UP skin drawing over it, the banner's own title logo, the UP names and one meta line on a dark fade.
import { useState } from 'react';
import { status } from './bannerTime.mts';
import { artUrl, skinImage, sliceMeta, upCharacters, type Banner, type BannersDoc } from './bannersData.mts';

export type SliceChar = { slug: string; name_vi?: string; name_cn: string; skins?: { skinID: string; image?: string }[] };

/** Untranslated text: Chinese, the site's small ash dot, "(chưa dịch)" for screen readers (DESIGN.md Original Name Rule). */
export function Cn({ text }: { text: string }) {
  return <span className="bn-cn" lang="zh">{text}<span className="bn-sr"> (chưa dịch)</span></span>;
}

export function BannerSlice({ banner, doc, now, characters, isArchive = false }:
  { banner: Banner; doc: BannersDoc; now: number; characters: Record<string, SliceChar>; isArchive?: boolean }) {
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const hide = (key: string) => () => setBroken((b) => ({ ...b, [key]: true }));
  const ups = upCharacters(banner, characters);
  const bg = broken.bg ? null : artUrl(doc, banner.art);
  const fig = broken.fig ? null : skinImage(banner, characters);
  const logo = broken.logo ? null : artUrl(doc, banner.title);
  const meta = sliceMeta(banner, now, isArchive);
  const ended = !isArchive && status(now, banner.start, banner.end) === 'ended';
  const body = (
    <>
      {bg && <img className="bn-slice-bg" src={bg} alt="" loading="lazy" onError={hide('bg')} />}
      {fig && <img className="bn-slice-fig" src={fig} alt="" loading="lazy" onError={hide('fig')} />}
      <span className="bn-slice-txt">
        {logo && <img className="bn-slice-logo" src={logo} alt="" loading="lazy" onError={hide('logo')} />}
        <span className="bn-slice-name">
          {ups.length ? ups.map(({ char }) => char.name_vi || char.name_cn).join(' · ') : <Cn text={banner.name_cn} />}
        </span>
        <span className="bn-slice-meta">{meta.label}{meta.left && <> · còn <b>{meta.left}</b></>}</span>
      </span>
    </>
  );
  // A slice opens its first UP character; a banner without one (choice banners, 强化A池) is not a link.
  return ups[0]
    ? <a className="bn-slice" href={`#/characters/${ups[0].char.slug}`} data-ended={ended || undefined}>
        {body}<span className="bn-slice-cue" aria-hidden="true">Xem Khí Giả ›</span>
      </a>
    : <div className="bn-slice" data-ended={ended || undefined}>{body}</div>;
}

/** The grid of slices: 2 per row; an odd count ends with a row of 3 (never an empty cell). */
export function BannerGrid({ banners, ...rest }:
  { banners: Banner[]; doc: BannersDoc; now: number; characters: Record<string, SliceChar>; isArchive?: boolean }) {
  // the archive is a compact 3-up grid (critique 2026-09-30: 94 hero-size slices were a 14k px scroll on phones)
  const cls = rest.isArchive ? 'bn-grid bn-grid--compact' : `bn-grid${banners.length % 2 ? ' bn-grid--odd' : ''}`;
  return (
    <div className={cls}>
      {banners.map((b) => <BannerSlice key={b.id} banner={b} {...rest} />)}
    </div>
  );
}
