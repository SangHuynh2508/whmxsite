// Tab title after in-app navigation; same wording as tools/prerender-lib.mjs (crawlers read that file, not this).
const SITE = 'Vật Hoa Di Tân Wiki';
const nm = (o: any) => (o?.name_vi || o?.name_cn || '').trim();
const VIEW: Record<string, string> = { catalog: 'Danh sách Khí Giả', gallery: 'Trang phục', 'tier-list': 'Tier list', music: 'Nhạc', banners: 'Banner', info: 'Thông tin', weapons: 'Vũ khí', calculator: 'Máy tính' };

type Route = { view: string; slug?: string; subtab?: string; skinId?: string };

export function pageTitle(route: Route, data: { characters: Record<string, any> }): string {
  const chars = Object.values(data.characters);
  if (route.view === 'character') {
    const c = chars.find((x) => x.slug === route.slug);
    if (!c) return SITE;
    const h = route.subtab === 'build' ? `Build ${nm(c)}` : route.subtab === 'lore' ? `Hồ sơ ${nm(c)}` : `${nm(c)} (${c.name_cn})`;
    return `${h} — ${SITE}`;
  }
  if (route.view === 'skin-detail') {
    for (const c of chars) {
      const s = c.skins?.find((x: any) => x.skinID === route.skinId);
      if (s) return `${nm(s)} — ${nm(c)} — ${SITE}`;
    }
    return SITE;
  }
  return VIEW[route.view] ? `${VIEW[route.view]} — ${SITE}` : SITE;
}

/** Title + calculator noindex (the calculator has no prerendered file; its URL carries a character query). */
export function setPageMeta(route: Route, data: { characters: Record<string, any> }) {
  document.title = pageTitle(route, data);
  let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (route.view === 'calculator') {
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.append(robots); }
    robots.content = 'noindex';
  } else robots?.remove();
}
