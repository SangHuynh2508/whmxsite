// Tiles of the Thông tin hub (owner 2026-09-30: "thông tin là 1 giao diện nền đen, các component tượng trưng cho các
// tính năng, dùng ảnh từ game, ấn vào mới vào chức năng — giống info s1n"). Art = the game's own assets.
window.INFO = [
  { key: 'banners', name: 'Banner', desc: 'Banner đang mở, đếm ngược và toàn bộ banner từ 2024.', href: '#/banners',
    art: { bg: '../../home/design-demos/assets/2114.webp', fig: 'https://pub-c0dceaa4fc5b48d1811c48f6f91a899c.r2.dev/characters/a0184/drawings/a0184001.webp', logo: '../../home/design-demos/assets/title-2114.webp' } },
  { key: 'weapons', name: 'Vũ Khí', desc: 'Vũ khí, kỹ năng và dòng thuộc tính.', href: '#/weapons', soon: 'Đang phát triển',
    art: { frame: '../../../../public/assets/frames/itemRare5.png', icons: [31541, 31542, 31543, 31544, 31545].map((id) => `../../../../public/assets/items/itemicon_${id}.png`) } },
];
