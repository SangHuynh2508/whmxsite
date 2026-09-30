// Tile art: banner = pool background + UP drawing (+ title logo); weapons = five weapon icons in the game's itemRare5 frame.
function art(t, withLogo) {
  if (t.art.bg) return `<img class="a-bg" src="${t.art.bg}" alt=""><img class="a-fig" src="${t.art.fig}" alt="">${withLogo ? `<img class="a-logo" src="${t.art.logo}" alt="">` : ''}`;
  return `<div class="wpn">${t.art.icons.map((i) => `<span style="background-image:url(${t.art.frame})"><img src="${i}" alt=""></span>`).join('')}</div>`;
}
