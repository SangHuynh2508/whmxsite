// server/profile/profile-code-maps.mjs
// JS copies of the maps in tools/build_web_data.py. DEPARTMENT_VI moves into lore_terms
// once owners translate organisations in Admin (spec §5); keep both copies in sync until then.
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
