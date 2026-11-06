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
  skill: 'Kỹ Năng', huanzhang: 'Hoán Chương', zhizhi: 'Trí Tri', noDesc: 'Chưa có mô tả.',
  stTitle: 'Chỉ Số Chiến Đấu', stEmpty: 'Chưa có dữ liệu chỉ số chiến đấu cho nhân vật này.', stHp: 'Sinh Mệnh (HP)',
  stAtk: 'Tấn Công (ATK)', stPdef: 'Phòng Ngự Vật Lý', stMdef: 'Phòng Ngự Cấu Thuật', stSpd: 'Tốc Độ (SPD)',
  stMov: 'Di Chuyển (MOV)', stCrit: 'Tỷ Lệ Bạo Kích', stCritDmg: 'Sát Thương Bạo Kích', stMax: 'Tối đa', cells: 'ô',
  skCooldown: 'Hồi chiêu', skTurns: 'lượt', skCost: 'Tiêu hao', skRecover: 'Hồi VP', skSummon: 'Triệu hồi',
  skRange: 'PHẠM VI', skCastRange: 'Tầm thi triển:', skEffect: 'Hiệu ứng:', skRangeAlt: 'Phạm vi kỹ năng',
  skEmpty: 'Chưa có thông tin kỹ năng cho nhân vật này.', zzEmpty: 'Nhân vật này chưa có dữ liệu Trí Tri.',
  zzUpgrade: 'CƯỜNG HÓA KỸ NĂNG', hzEmpty: 'Nhân vật này chưa có dữ liệu Hoán Chương.', hzProps: 'TĂNG CƯỜNG THUỘC TÍNH',
  hzMaterial: 'Vật liệu', hzMats: 'NGUYÊN LIỆU HOÁN CHƯƠNG', hzNoSkill: 'Không có chi tiết kỹ năng Hoán Chương.',
  hzEffects: 'HIỆU ỨNG / KỸ NĂNG HOÁN CHƯƠNG', hzStory: 'Xem điển cố / cốt truyện Hoán Chương',
  infoModes: 'Nội dung thông tin nhân vật',
  tlEmpty: 'Nhân vật này chưa có dữ liệu thiên phú.', tlReqLv: 'Yêu cầu Lv.', close: 'Đóng', tlNeutral: 'Chưa mở',
  tlDone: 'Đã nâng', tlTarget: 'Mục tiêu', tlProgress: 'TIẾN CẤP KỸ NĂNG / THIÊN PHÚ', tlTier: 'Bậc', tlCoin: 'Đông Cốc Tệ',
  tlReqCharLv: 'Đạt cấp độ nhân vật', tlReqTalent: 'Mở thiên phú:', tlConditions: 'ĐIỀU KIỆN MỞ', tlUpgrade: 'Nâng Thiên Phú',
  tlUndo: 'Đã Nâng (Bấm để Hủy)', tlCost: 'CHI PHÍ NÂNG CẤP',
  glPortrait: 'Chân Dung', glModel: 'Tạo Hình', glSkin: 'Trang Phục', glBase: 'Ảnh Gốc',
  glZoom1: 'Phóng to hình ảnh {x} (1.4x)', glZoom2: 'Phóng to thêm hình ảnh {x} (1.8x)',
  glZoom0: 'Thu hình ảnh {x} về kích thước ban đầu (1.0x)',
  bdEmpty: 'Chưa có hướng dẫn build', bdEmptyText: 'Dữ liệu khuyến nghị trang bị, thâm tạo và đội hình cho {x} đang chưa được làm.',
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
  skill: '技能', huanzhang: '焕章', zhizhi: '知致', noDesc: '暂无描述。', // draft
  stTitle: '战斗属性', stEmpty: '该器者暂无战斗属性数据。', stHp: '生命', // draft
  stAtk: '攻击', stPdef: '物理防御', stMdef: '构术防御', stSpd: '速度', // draft
  stMov: '移动', stCrit: '暴击率', stCritDmg: '暴击伤害', stMax: '最高', cells: '格', // draft
  skCooldown: '冷却', skTurns: '回合', skCost: '消耗', skRecover: '回复', skSummon: '召唤', // draft
  skRange: '范围', skCastRange: '施放距离：', skEffect: '效果：', skRangeAlt: '技能范围', // draft
  skEmpty: '该器者暂无技能信息。', zzEmpty: '该器者暂无知致数据。', // draft
  zzUpgrade: '技能强化', hzEmpty: '该器者暂无焕章数据。', hzProps: '属性提升', // draft
  hzMaterial: '材料', hzMats: '焕章材料', hzNoSkill: '暂无焕章技能详情。', // draft
  hzEffects: '焕章效果 / 技能', hzStory: '查看焕章典故', // draft
  infoModes: '器者资料内容', // draft
  tlEmpty: '该器者暂无天赋数据。', tlReqLv: '需要 Lv.', close: '关闭', tlNeutral: '未解锁', // draft
  tlDone: '已提升', tlTarget: '目标', tlProgress: '技能 / 天赋进阶', tlTier: '等级', tlCoin: '冬谷币', // draft
  tlReqCharLv: '器者等级达到', tlReqTalent: '解锁天赋：', tlConditions: '解锁条件', tlUpgrade: '提升天赋', // draft
  tlUndo: '已提升（点击取消）', tlCost: '提升消耗', // draft
  glPortrait: '写照', glModel: '造形', glSkin: '装束', glBase: '原图', // draft
  glZoom1: '放大图片 {x}（1.4x）', glZoom2: '继续放大图片 {x}（1.8x）', // draft
  glZoom0: '将图片 {x} 恢复原始大小（1.0x）', // draft
  bdEmpty: '暂无配装指南', bdEmptyText: '{x} 的装备、深造与阵容推荐尚未完成。', // draft
};
export const strings: Record<Lang, Record<StringKey, string>> = { vi, cn };
export const s = (key: StringKey, l: Lang = getLang()) => strings[l][key];
