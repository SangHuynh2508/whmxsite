import { getLang, type Lang } from './lang.mts';

const vi = {
  navCharacters: 'Khí Giả', navTier: 'Tier List', navSkins: 'Trang Phục', navInfo: 'Thông tin', navTools: 'Công cụ',
  navAdmin: 'Quản trị', navLogin: 'Đăng nhập', navLang: 'Ngôn ngữ',
  navMenu: 'Menu', navAccount: 'Tài khoản', navLogout: 'Đăng xuất', menuClose: 'Đóng menu',
  searchPlaceholder: 'Tìm Khí Giả hoặc trang phục', navRail: 'Thanh điều hướng ứng dụng',
  catEmpty: 'Không tìm thấy nhân vật nào phù hợp.', catRecords: 'hồ sơ', catSearch: 'Tìm kiếm theo tên nhân vật...',
  catSearchClear: 'Xóa nội dung tìm kiếm', catFilter: 'Bộ Lọc', catJob: 'Chức nghiệp', catRarity: 'Độ hiếm',
  catPool: 'Phân loại', catStandard: 'Thường', catHuanZhang: 'HOÁN CHƯƠNG', catHasHz: 'Có Hoán Chương',
  catSort: 'SẮP XẾP', catSortLatest: 'Mới Nhất', catSortName: 'Tên', catSortRarity: 'Độ Hiếm', catClear: 'Xóa bộ lọc',
  job1: 'Túc Vệ', job2: 'Khinh Nhuệ', job3: 'Viễn Kích', job4: 'Cấu Thuật', job5: 'Chiến Lược', jobOther: 'Khác',
  pickTitle: 'Chọn Nhân Vật', pickClose: 'Đóng', pickAll: 'Tất cả', untranslatedTag: 'chưa dịch',
  limited: 'Limited', hdrPickHint: 'Bấm vào hình đại diện để chọn nhân vật', hdrChange: 'Đổi nhân vật', hdrVariant: 'Biến thể',
  cdNotFound: 'Không tìm thấy nhân vật', cdNotFoundText: 'Thẻ nhân vật "{id}" không tồn tại hoặc đã bị ẩn.',
  cdBackList: '← Về danh sách nhân vật', cdBreadcrumb: 'Danh Sách Khí Giả', cdClass: 'Lớp', cdSubNav: 'Điều hướng chi tiết nhân vật',
  tabOverview: 'Tổng Quan', tabInfo: 'Thông Tin', tabTalents: 'Thiên Phú', tabBuild: 'Build', tabLore: 'Hồ Sơ Lưu Trữ',
  tabTea: 'Phòng Trà', tabGallery: 'Thư Viện',
  ovTitle: 'Hồ Sơ Khí Giả', ovName: 'Tên hiển thị:', ovFullname: 'Tên đầy đủ:', ovJob: 'Khí Giả:', ovBanner: 'Loại banner:',
  ovStaff: 'Tình trạng nhân sự:', ovRecord: 'Mã hồ sơ:', ovNickname: 'Tên thường gọi:', ovCnName: 'Tên gốc (CN):',
  ovAttack: 'Kiểu tấn công:', ovDept: 'Trực thuộc:', ovEntity: 'Tình trạng bản thể:', ovUnknown: 'Chưa xác định',
  ovMelee: 'Cận chiến', ovRanged: 'Tầm xa',
};
export type StringKey = keyof typeof vi;
const cn: Record<StringKey, string> = {
  navCharacters: '器者', navTier: '强度榜', // draft
  navSkins: '装束', navInfo: '资料', // draft
  navTools: '工具', // draft
  navAdmin: '管理', navLogin: '登录', navLang: '语言', // draft
  navMenu: '菜单', navAccount: '账号', navLogout: '退出登录', menuClose: '关闭菜单', // draft
  searchPlaceholder: '搜索器者或装束', navRail: '应用导航栏', // draft
  catEmpty: '没有找到符合条件的器者。', catRecords: '份档案', catSearch: '按器者名称搜索...', // draft
  catSearchClear: '清除搜索内容', catFilter: '筛选', catJob: '职业', catRarity: '稀有度', // draft
  catPool: '分类', catStandard: '常驻', catHuanZhang: '焕章', catHasHz: '有焕章', // draft
  catSort: '排序', catSortLatest: '最新', catSortName: '名称', catSortRarity: '稀有度', catClear: '清除筛选', // draft
  job1: '足卫', job2: '轻锐', job3: '远击', job4: '构术', job5: '战略', jobOther: '其他', // draft
  pickTitle: '选择器者', pickClose: '关闭', pickAll: '全部', untranslatedTag: '未翻译', // draft
  limited: '限定', hdrPickHint: '点击头像选择器者', hdrChange: '更换器者', hdrVariant: '变体', // draft
  cdNotFound: '未找到器者', cdNotFoundText: '器者“{id}”不存在或已隐藏。', // draft
  cdBackList: '← 返回器者列表', cdBreadcrumb: '器者列表', cdClass: '职业', cdSubNav: '器者详情导航', // draft
  tabOverview: '概览', tabInfo: '资料', tabTalents: '天赋', tabBuild: '配装', tabLore: '档案', // draft
  tabTea: '茶室', tabGallery: '图库', // draft
  ovTitle: '器者档案', ovName: '名称：', ovFullname: '全名：', ovJob: '器者：', ovBanner: '卡池类型：', // draft
  ovStaff: '人事状态：', ovRecord: '档案编号：', ovNickname: '常用称呼：', ovCnName: '原名：', // draft
  ovAttack: '攻击方式：', ovDept: '所属：', ovEntity: '本体状态：', ovUnknown: '未知', // draft
  ovMelee: '近战', ovRanged: '远程', // draft
};
export const strings: Record<Lang, Record<StringKey, string>> = { vi, cn };
export const s = (key: StringKey, l: Lang = getLang()) => strings[l][key];
