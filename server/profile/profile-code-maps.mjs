// server/profile/profile-code-maps.mjs
// JS copies of the maps in tools/build_web_data.py. DEPARTMENT_VI is used only by the legacy shape
// (parity gate 1); v2 organisation names come from lore_terms (seeded 2026-09, spec Q7).
export const DEPARTMENT_VI = Object.freeze({
  资料部: 'Bộ Tư Liệu',
  商业部: 'Bộ Thương Mại',
  技术部: 'Bộ Kỹ Thuật',
  执行部: 'Bộ Hành Chính',
  航海家联盟: 'Liên Minh Hàng Hải',
  '冬谷·航海家联盟': 'Đông Cốc · Liên Minh Hàng Hải',
  塞纳回廊: 'Hành Lang Seine',
  不列颠学会: 'Học Viện Anh Quốc',
  方塔联合会: 'Liên Minh Tháp Phương',
  繁星花协会: 'Hiệp Hội Hoa Phồn Tinh',
});
export const STAFF_STATUS_MAP = Object.freeze({ 已登记: 'Đã đăng ký', 待登记: 'Chờ đăng ký' });
export const STORE_STATUS_MAP = Object.freeze({ 安全: 'An toàn', 观察: 'Theo dõi', 特勤: 'Đặc cần' });
