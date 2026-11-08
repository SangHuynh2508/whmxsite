import { getLang, type Lang } from './lang.mts';

const vi = {
  navCharacters: 'Khí Giả', navTier: 'Tier List', navSkins: 'Trang Phục', navInfo: 'Thông tin', navTools: 'Công cụ',
  navAdmin: 'Quản trị', navLogin: 'Đăng nhập', navLang: 'Ngôn ngữ',
  navPages: 'Trang', navHome: 'Trang chủ', navMenu: 'Menu', navAccount: 'Tài khoản', navLogout: 'Đăng xuất', menuClose: 'Đóng menu',
  searchPlaceholder: 'Tìm Khí Giả hoặc trang phục', navRail: 'Thanh điều hướng ứng dụng',
  catEmpty: 'Không tìm thấy nhân vật nào phù hợp.', catRecords: 'hồ sơ', catSearch: 'Tìm kiếm theo tên nhân vật...',
  catSearchClear: 'Xóa nội dung tìm kiếm', catFilter: 'Bộ Lọc', catJob: 'Chức nghiệp', catRarity: 'Độ hiếm',
  catPool: 'Phân loại', catStandard: 'Thường', catHuanZhang: 'HOÁN CHƯƠNG', catHasHz: 'Có Hoán Chương',
  catSort: 'SẮP XẾP', catSortLatest: 'Mới Nhất', catSortName: 'Tên', catSortRarity: 'Độ Hiếm', catSortHp: 'HP', catSortAtk: 'ATK', catSortDef: 'DEF', catSortRes: 'RES', catClear: 'Xóa bộ lọc',
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
  infoModes: 'Nội dung thông tin nhân vật', infoSkills: 'Thông Tin Kỹ Năng', infoHz: 'Thông Tin Hoán Chương',
  tlEmpty: 'Nhân vật này chưa có dữ liệu thiên phú.', tlReqLv: 'Yêu cầu Lv.', close: 'Đóng', tlNeutral: 'Chưa mở',
  tlDone: 'Đã nâng', tlTarget: 'Mục tiêu', tlProgress: 'TIẾN CẤP KỸ NĂNG / THIÊN PHÚ', tlTier: 'Bậc', tlCoin: 'Đông Cốc Tệ',
  tlReqCharLv: 'Đạt cấp độ nhân vật', tlReqTalent: 'Mở thiên phú:', tlConditions: 'ĐIỀU KIỆN MỞ', tlUpgrade: 'Nâng Thiên Phú',
  tlUndo: 'Đã Nâng (Bấm để Hủy)', tlCost: 'CHI PHÍ NÂNG CẤP',
  glPortrait: 'Chân Dung', glModel: 'Tạo Hình', glSkin: 'Trang Phục', glBase: 'Ảnh Gốc',
  glZoom1: 'Phóng to hình ảnh {x} (1.4x)', glZoom2: 'Phóng to thêm hình ảnh {x} (1.8x)',
  glZoom0: 'Thu hình ảnh {x} về kích thước ban đầu (1.0x)',
  bdEmpty: 'Chưa có hướng dẫn build', bdEmptyText: 'Dữ liệu khuyến nghị trang bị, thâm tạo và đội hình cho {x} đang chưa được làm.',
  rgPassive: 'Nội tại', rgSelf: 'Bản thân', rgFull: 'Toàn bản đồ', rgAuto: 'Tự động', rgCells: '{n} ô',
  rgSingle: '1 mục tiêu (Đơn thể)', rgSquare: 'Diện rộng {n} × {n} ô', rgOverlap: 'Xung quanh {n} ô',
  rgRect1: 'Hàng thẳng 1 × {n} ô', rgRect3: 'Hàng ngang 3 × {n} ô', rgRect5: 'Hàng ngang 5 × {n} ô',
  rgDash: 'Đường lướt {n} ô', rgPierce: 'Hàng thẳng xuyên thấu {n} ô', rgCross: 'Chữ thập',
  rgSpecial: 'Đặc biệt ({n})', rgArea: 'Phạm vi', rgSpecialN: 'Đặc biệt {n}',
  loreRelic: 'Hiện vật', loreType: 'Loại', loreEra: 'Niên đại', loreMuseum: 'Nơi lưu giữ', loreDept: 'Trực thuộc',
  loreEntity: 'Bản thể', loreRecord: 'Mã hồ sơ', loreFootnote: '* Bấm vào từng mục trong phiếu để xem ghi chú.',
  loreEmpty: 'Chưa có hồ sơ lưu trữ.', loreMore: 'Đọc tiếp', loreLess: 'Thu gọn', loreOrigin: 'Nguồn gốc',
  loreTimeline: 'Dòng thời gian', loreReports: 'Báo cáo đánh giá', loreSecret: 'Báo cáo mật', loreReportN: 'Báo cáo {n}',
  loreUnlock: 'Mở khoá ở cảm ứng', loreLv: 'cấp {n} · ',
  teaEmpty: 'Chưa có dữ liệu phòng trà.', teaFav: 'Trà yêu thích', teaHint: 'Mời đúng loại trà, khí giả sẽ bình về nó.',
  teaRound12: 'Câu 1 và câu 2. Mỗi câu, game hiện 3 trong {n} chủ đề.',
  teaRound34: 'Câu 3 và câu 4. Game hiện {n} chủ đề, chủ đề đã chọn mở ra 2 câu tiếp.',
  teaEnd: 'Kết thúc tiệc trà', teaWin: 'Khi thành công', teaLose: 'Khi thất bại',
  teaLike: 'Khí giả thích chủ đề này', teaPuzzled: 'Khí giả bối rối',
  homeTitle: 'Vật Hoa Di Tân', homeOpen: 'Banner đang mở', homeAllBanners: 'Tất cả banner ›', homeEvents: 'Sự kiện đang diễn ra',
  homeLeft: 'Còn', homeLeftLc: 'còn', homeReleases: 'Mới ra mắt', homeNew: 'Mới', homeSkin: 'Trang phục', homeChar: 'Khí Giả',
  homeTheme: 'Sự kiện chủ đề',
  bnTitle: 'Banner', bnLoadErr: 'Chưa tải được dữ liệu banner', bnOpen: 'Đang mở', bnAll: 'Tất cả banner', bnUnit: 'banner',
  bnType: 'Loại', bnYear: 'Năm', bnNoMatch: 'Không có banner nào khớp bộ lọc.', bnEnded: 'Đã kết thúc · chờ bản cập nhật',
  bnChoice: 'Tự chọn trong {n} Khí Giả', bnCue: 'Xem Khí Giả ›', bnVersion: 'Phiên bản {n}',
  tmDH: '{d} ngày {h} giờ', tmHM: '{h} giờ {m} phút', tmM: '{m} phút', tmLt: '< 1 phút',
  skAllSrc: 'Tất Cả Nguồn',
  skTicket: 'Vé Trang Phục',
  skHigh: 'Cao Cấp',
  skTravel: 'Du Lịch',
  skEvent: 'Sự Kiện',
  skShop: 'Cửa Hàng',
  skTraining: 'Tập Huấn',
  skStory: 'Cốt Truyện',
  skFree: 'Miễn Phí',
  sortDate: 'Mới ra mắt gần đây',
  sortName: 'Tên trang phục (A-Z)',
  sortChar: 'Tên Khí Giả (A-Z)',
  sortPrice: 'Giá vé (Thấp đến Cao)',
  sortId: 'Theo mã trang phục',
  skPrice: 'Giá: {p} {c}',
  skHighFull: 'Trang phục cao cấp (Bán giới hạn qua gói quà)',
  skFullStory: 'Mở khóa sau khi hoàn thành cốt truyện',
  skFullTraining: 'Nhận được thông qua Chợ Tập Huấn',
  skFullTravel: 'Nhận được thông qua Du Lịch',
  skFullZhenji: 'Nhận được qua Trân Tập Dịch Thị',
  skFullShop: 'Bán giới hạn tại Cửa Hàng Trang Phục',
  skFullBook: 'Nhận được qua phần thưởng hẹn trước',
  skFullHuaChao: 'Nhận được qua hoạt động Hoa Triêu Tích Thời',
  skFullXieYun: 'Nhận được qua hoạt động Hiệp Vận Hành Ca',
  skFullEvent: 'Nhận được thông qua hoạt động',
  skFullFree: 'Quà tặng trứng phục sinh (彩蛋赠送)',
  skFullOther: 'Cách thức sở hữu đặc biệt',
  skObtainDefault: 'Bán tại Cửa Hàng / Sự Kiện',
  skObtainGift: 'Bán qua gói quà',
  skLimitedPrice: 'Giới hạn',
  skLoading: 'Đang tải dữ liệu thư viện trang phục...',
  skAllChars: 'Tất cả Khí Giả',
  skMuseum: 'BẢO TÀNG VẬT HOA DI TÂN • THƯ VIỆN TRANG PHỤC',
  skTitle: 'Bộ Sưu Tập Y Phục Khí Giả',
  skIntro: 'Khám phá 145 trang phục đặc biệt ghi dấu điển cố lịch sử, phong vị bốn mùa và nghệ thuật cổ vật ngàn năm.',
  skHeroAria: 'Triển lãm tiêu điểm trang phục cao cấp',
  skAppraisal: 'HỒ SƠ GIÁM ĐỊNH',
  skSpotBadge: 'TIÊU ĐIỂM CAO CẤP',
  skSeriesOf: 'Dòng y phục: {n}',
  skSeriesLogo: 'Logo dòng y phục',
  skObtain: 'Cách thức sở hữu',
  skFactoryPrice: 'Giá xuất xưởng',
  skViewDetail: 'Xem chi tiết trang phục',
  skViewDetailN: 'Xem chi tiết trang phục {n}',
  skSpotNav: 'Điều hướng tiêu điểm cao cấp',
  skSpotPrev: 'Trang phục tiêu điểm trước',
  skSpotNext: 'Trang phục tiêu điểm kế tiếp',
  skSpotProgress: 'Tiến trình tiêu điểm',
  skSpotGo: 'Chuyển đến tiêu điểm {n}',
  skZoomDrawing: 'Nhấn để xem ảnh phóng to (Drawing)',
  skZoomHero: 'Xem ảnh phóng to trang phục tiêu điểm',
  skSpotExhibit: 'TIÊU ĐIỂM TRIỂN LÃM',
  skToolbar: 'Bộ lọc và tìm kiếm trang phục',
  skSearch: 'Tìm theo tên trang phục, Khí Giả...',
  skFilterChar: 'Lọc theo Khí Giả',
  skSortAria: 'Sắp xếp trang phục',
  skAcqTitle: 'Phương thức sở hữu',
  skSeriesTitle: 'Dòng Y Phục',
  skCabinet: 'Tủ dòng y phục',
  skAllSeries: 'Tất Cả Series ({n})',
  skGridLabel: 'Danh sách trang phục',
  skZoomAria: 'Xem ảnh phóng to',
  skCloseEsc: 'Đóng (Escape)',
  skZoomAlt: 'Trang phục phóng to',
  skCount: 'Hiển thị {n} / {m} trang phục',
  skNoMatch: 'Không tìm thấy trang phục nào phù hợp với bộ lọc.',
  skTicketAlt: 'Vé',
  skHighDash: 'Trang phục cao cấp - ',
  skHighAlt: 'Trang Phục Cao Cấp',
  skLoreDefault: 'Chế tác mô phỏng dáng hình kiệt tác. Nét vẽ thanh thoát, thần thái tôn nghiêm, toát lên phong vận hội họa cổ truyền đỉnh cao.',
  sdLoading: 'Đang tải dữ liệu trang phục...',
  sdNotFound: 'Không tìm thấy trang phục',
  sdNotFoundText: 'Mã trang phục "{id}" không tồn tại hoặc chưa được phát hành.',
  sdBack: '← Quay lại Thư Viện Trang Phục',
  sdLibrary: 'Thư Viện Trang Phục',
  sdEventFree: 'Sự kiện / Miễn phí',
  sdNoInfo: 'Chưa có thông tin',
  sdNav: 'Điều hướng trang phục',
  sdHeroAria: 'Hình ảnh tiêu điểm trang phục',
  sdZoomHint: 'Nhấn để xem ảnh phóng to',
  sdDossier: 'Hồ Sơ Giám Định Trang Phục',
  sdOwner: 'Khí Giả sở hữu:',
  sdCost: 'Chi phí / Tiền tệ:',
  sdRelease: 'Thời điểm phát hành:',
  sdClass: 'Phân loại y phục:',
  sdHighType: 'Trang Phục Tương Tác Cao Cấp',
  sdNormalType: 'Trang Phục Thường',
  sdSeries: 'Dòng y phục (Series):',
  sdCv: 'Diễn viên lồng tiếng (CV):',
  sdAssets: 'Bộ Tài Nguyên Hình Ảnh',
  sdDrawing: 'Toàn Cảnh (Drawing)',
  sdDrawingSub: 'Đồ họa toàn thân độ phân giải cao • Nhấn để xem toàn màn hình',
  sdDrawingAria: 'Xem ảnh phóng to Toàn Cảnh',
  sdCard: 'Thẻ Bài (Card)',
  sdCardSub: 'Hình dạng thẻ bài trong giao diện tra cứu • Nhấn để xem',
  sdCardAria: 'Xem ảnh phóng to Thẻ Bài',
  sdAvatar: 'Chân Dung (Avatar)',
  sdAvatarSub: 'Ảnh đại diện khí giả khi khoác y phục • Nhấn để xem',
  sdAvatarAria: 'Xem ảnh phóng to Chân Dung',
  trTitle: 'Tier List tổng hợp', trRef: 'Tham khảo tier list của', trUpdated: 'Cập nhật', trOld: 'Cũ', trTabs: 'Nội dung tier list',
  trTabChars: 'Nhân vật', trTabTeams: 'Đội hình', trTabInfo: 'Thông tin', trSearch: 'Tìm Khí Giả', trSearchAria: 'Tìm Khí Giả theo tên',
  trCount: '{n} Khí Giả', trLeft: 'Còn {n} Khí Giả', trNoMatch: 'Không có Khí Giả nào khớp.', trMissing: 'Không tìm thấy tier list này.',
  trSeeAll: 'Xem các tier list', trNone: 'Chưa có tier list.', trLegZ: 'mốc Trí Tri tối thiểu', trLegHc: 'cần Hoán Chương',
  ifBannerDesc: 'Banner đang mở, đếm ngược và toàn bộ banner đã qua.', ifWeapons: 'Vũ Khí',
  ifWeaponsDesc: 'Vũ khí, kỹ năng và dòng thuộc tính.', ifMusicDesc: 'Nhạc nền trong game, nghe ngay trên web.', ifSoon: 'Đang phát triển', wpPlaceholder: 'Nội dung đang được demo trong tưởng tượng, vui lòng đợi.',
  cChangeChar: 'Đổi Khí Giả', cAvatarTitle: 'Bấm để chọn nhân vật', cAvatarAria: 'Chọn nhân vật',
  cLevel: 'Cấp độ (Level)', cLevelMax: 'Tối đa 120', cCur: 'Hiện tại', cReport: 'Báo Cáo Tài Nguyên', cExp: 'Kinh Nghiệm',
  cMats: 'Vật liệu cần', cNoMats: 'Không cần tài nguyên cho khoảng này.', cVan: 'vạn',
  cFooter: 'Vật Hoa Di Tân Calculator là dự án fan-made, phi thương mại và không liên kết với nhà phát hành chính thức. Các hình ảnh, tên gọi và tài sản trò chơi liên quan đến 物华弥新 thuộc quyền sở hữu của các chủ sở hữu tương ứng.',
  bdAffixes: 'Dòng thuộc tính', bdNoReroll: 'Không cần tẩy luyện vũ khí.', bdDeepens: 'Thâm tạo', bdSeeTalents: 'Xem thiên phú ›',
  bdPoints: '{n}/11 điểm', bdRotation: 'Xoay vòng', bdTips: 'Mẹo', bdSeeSkills: 'Xem kỹ năng ›',
  mnEmpty: 'Không tìm thấy. Thử tên tiếng Trung hoặc bỏ dấu.', ldErr: 'Không tải được dữ liệu', ldErrText: 'Kiểm tra kết nối mạng rồi tải lại trang.',
  trLegRest: 'không nhãn = không cần mốc · trong một tier, bên trái mạnh hơn · bấm để xem build',
  navMusic: 'Âm nhạc', muTitle: 'Âm nhạc', muAll: 'Tất cả', muNew: 'Mới cập nhật', muJukebox: 'Máy hát', muStory: 'Truyện', muStage: 'Màn đánh',
  muArea: 'Bản đồ', muOther: 'Khác', muSearch: 'Tìm theo tên bài', muEmpty: 'Không có bài nào phù hợp.',
  muLoadError: 'Không tải được danh sách nhạc.', muPlayError: 'Không phát được bài này.', muSource: 'Nguồn',
  muUsedEvent: 'Dùng trong sự kiện', muEvent: 'Sự kiện', muUsedStory: 'Dùng trong truyện', muUsedStage: 'Dùng trong màn đánh', muUsedArea: 'Dùng ở bản đồ', muMore: '+{n} màn khác',
  muLede: '{n} bản nhạc nền trích từ game, bản {v}. Tên chữ Hán có chấm xám là tên chưa dịch.', muClear: 'Xóa tìm kiếm',
  muRetry: 'Thử lại', muPlay: 'Phát', muPause: 'Tạm dừng', muMute: 'Tắt tiếng', muUnmute: 'Bật tiếng', muVolume: 'Âm lượng',
  muSeek: 'Vị trí', muPrev: 'Bài trước', muNext: 'Bài sau', muScenes: '{n} cảnh',
  muScenesTotal: 'Tổng {n} cảnh truyện', muNoUse: 'Chưa tìm thấy nơi game dùng bài này.',
};
export type StringKey = keyof typeof vi;
const cn: Record<StringKey, string> = {
  navCharacters: '器者', // game: interfaceLan_interface_nameLan_1003
  navTier: '强度榜', // draft
  navSkins: '衣装', // game: interfaceLan_interface_gotoLan_1011
  navInfo: '资料', // draft
  navTools: '工具', // draft
  navAdmin: '管理', navLogin: '登录', navLang: '语言', // draft
  navPages: '页面', navHome: '首页', navMenu: '菜单', navAccount: '账号', navLogout: '退出登录', menuClose: '关闭菜单', // draft
  searchPlaceholder: '搜索器者或衣装', navRail: '应用导航栏', // draft
  catEmpty: '没有找到符合条件的器者。', catRecords: '份档案', catSearch: '按器者名称搜索...', // draft
  catFilter: '筛选', // game: CollectionScreenPanel_UI_24
  catJob: '职业', // game: CollectionScreenPanel_UI_2
  catRarity: '稀有度', // game: HeroPackagePanel_UI_2
  catSearchClear: '清除搜索内容', // draft
  catStandard: '常驻', // game: LangGlobalLan_LangGlobal_name_2482
  catHuanZhang: '焕彰', // game: LangGlobalLan_LangGlobal_name_17320 一键焕彰
  catPool: '分类', catHasHz: '有焕彰', // draft
  catSort: '排序', // game: CollectionScreenPanel_UI_1
  catSortRarity: '稀有度', // game: HeroPackagePanel_UI_2
  catSortLatest: '最新', catSortName: '名称', catClear: '清除筛选', // draft
  job1: '宿卫', // game: characterlan_job_namelan_1
  job2: '轻锐', // game: characterlan_job_namelan_2
  job3: '远击', // game: characterlan_job_namelan_3
  job4: '构术', // game: characterlan_job_namelan_4
  job5: '战略', // game: characterlan_job_namelan_5
  jobOther: '其他', // game: CollectionScreenPanel_UI_22
  pickAll: '全部', // game: LangGlobalLan_LangGlobal_name_2400
  pickTitle: '选择器者', pickClose: '关闭', untranslatedTag: '未翻译', // draft
  limited: '限定', // game: LangGlobalLan_LangGlobal_name_2497
  hdrPickHint: '点击头像选择器者', hdrChange: '更换器者', hdrVariant: '变体', // draft
  cdNotFound: '未找到器者', cdNotFoundText: '器者“{id}”不存在或已隐藏。', // draft
  cdBreadcrumb: '器者列表', // game: interfaceLan_interface_nameLan_1002
  cdBackList: '← 返回器者列表', cdClass: '职业', cdSubNav: '器者详情导航', // draft
  tabTalents: '深造', // game: interfaceLan_interface_nameLan_1110 (HeroTalentPanel = 深造点数)
  tabOverview: '概览', tabInfo: '资料', tabBuild: '配装', tabLore: '档案', // draft
  tabTea: '茶室', // game: interfaceLan_interface_nameLan_1300
  tabGallery: '图库', // draft
  ovTitle: '器者档案', // game: HeroManagePanel_UI_8
  ovName: '名称：', ovFullname: '全名：', ovJob: '器者：', ovBanner: '招集类型：', // draft
  ovStaff: '人事状态：', ovRecord: '档案编号：', ovNickname: '常用称呼：', ovCnName: '原名：', // draft
  ovAttack: '攻击方式：', ovDept: '所属：', ovEntity: '本体状态：', ovUnknown: '未知', // draft
  ovMelee: '近战', ovRanged: '远程', // draft
  huanzhang: '焕彰', // game: LangGlobalLan_LangGlobal_name_17320
  zhizhi: '致知', // game: HeroManagePanel_UI_5
  skill: '技能', noDesc: '暂无描述。', // draft
  stHp: '生命值', // game: characterlan_AttrDes_namelan_Hp_FIX
  stTitle: '战斗属性', stEmpty: '该器者暂无战斗属性数据。', // draft
  stAtk: '攻击力', // game: characterlan_AttrDes_namelan_Atk
  stPdef: '物理防御', // game: characterlan_AttrDes_namelan_PhysicDef
  stMdef: '构素防御', // game: characterlan_AttrDes_namelan_MagicDef
  stSpd: '速度', // game: characterlan_AttrDes_namelan_Speed
  stMov: '移动力', // game: characterlan_AttrDes_namelan_Mov
  stCrit: '暴击率', // game: characterlan_AttrDes_namelan_Critical_FIX
  stCritDmg: '暴击伤害', // game: characterlan_AttrDes_namelan_CritDmg_FIX
  stMax: '最高', cells: '格', // draft
  skCooldown: '冷却', // game: UISkillDetailsItem_2 冷却:
  skCost: '消耗', // game: UISkillDetailsItem_0 消耗:
  skTurns: '回合', skRecover: '回复', skSummon: '召唤', // draft
  skCastRange: '射程：', // game: UIPopupSkillDetails_UI_1
  skRange: '范围', skEffect: '效果：', skRangeAlt: '技能范围', // draft
  skEmpty: '该器者暂无技能信息。', zzEmpty: '该器者暂无致知数据。', // draft
  zzUpgrade: '技能强化', hzEmpty: '该器者暂无焕彰数据。', hzProps: '属性提升', // draft
  hzMaterial: '材料', hzMats: '焕彰材料', hzNoSkill: '暂无焕彰技能详情。', // draft
  hzEffects: '焕彰效果 / 技能', hzStory: '查看焕彰典故', // draft
  infoModes: '器者资料内容', infoSkills: '技能资料', infoHz: '焕彰资料', // draft
  tlNeutral: '未解锁', // game: SkillTipsPanel_UI_0
  tlEmpty: '该器者暂无深造数据。', tlReqLv: '需要 Lv.', close: '关闭', // draft
  tlCoin: '冬谷币', // game: RhythmGameShopPanel_UI_0
  tlDone: '已提升', tlTarget: '目标', tlProgress: '技能 / 深造进阶', tlTier: '等级', // draft
  tlConditions: '解锁条件', // game: HeroTalentPanel_UI_7
  tlReqCharLv: '器者等级达到', tlReqTalent: '解锁深造：', tlUpgrade: '提升深造', // draft
  tlUndo: '已提升（点击取消）', tlCost: '提升消耗', // draft
  glPortrait: '写照', // game: characterlan_characterSkin_skinNamelan_*002
  glModel: '肖形', // game: characterlan_characterSkin_skinNamelan_*001
  glSkin: '衣装', // game: interfaceLan_interface_gotoLan_1011
  glBase: '原图', // draft
  glZoom1: '放大图片 {x}（1.4x）', glZoom2: '继续放大图片 {x}（1.8x）', // draft
  glZoom0: '将图片 {x} 恢复原始大小（1.0x）', // draft
  bdEmpty: '暂无配装指南', bdEmptyText: '{x} 的装备、深造与阵容推荐尚未完成。', // draft
  rgSelf: '自身', // game: SkillLan_SkillSelectRange_Cross_0_0
  rgFull: '全地图', // game: SkillLan_SkillSelectRange_FullMap_0_0
  rgPassive: '被动', rgAuto: '自动', rgCells: '{n}格', // draft
  rgSingle: '单体', rgSquare: '{n}×{n}范围', rgOverlap: '周围{n}格', // draft
  rgRect1: '直线1×{n}格', rgRect3: '横排3×{n}格', rgRect5: '横排5×{n}格', // draft
  rgDash: '冲刺{n}格', rgPierce: '贯穿直线{n}格', rgCross: '十字', // draft
  rgSpecial: '特殊（{n}）', rgArea: '范围', rgSpecialN: '特殊 {n}', // draft
  loreRelic: '文物', loreType: '类型', loreEra: '年代', loreMuseum: '收藏地', loreDept: '所属', // draft
  loreEntity: '本体', loreRecord: '档案编号', loreFootnote: '* 点击档案中的条目查看注释。', // draft
  loreEmpty: '暂无档案。', loreMore: '展开', loreLess: '收起', loreOrigin: '来源', // draft
  loreTimeline: '时间线', loreReports: '评估报告', loreSecret: '机密报告', loreReportN: '报告 {n}', // draft
  loreUnlock: '感应解锁', loreLv: '{n}级 · ', // draft
  teaEmpty: '暂无茶室数据。', teaFav: '喜爱的茶', teaHint: '奉上合适的茶，器者会品评一番。', // draft
  teaRound12: '第1、2问。每问游戏从 {n} 个话题中显示3个。', // draft
  teaRound34: '第3、4问。游戏显示 {n} 个话题，所选话题会展开后续2问。', // draft
  teaEnd: '茶会结束', teaWin: '成功时', teaLose: '失败时', // draft
  teaLike: '器者喜欢这个话题', teaPuzzled: '器者感到困惑', // draft
  homeTitle: '物华弥新', homeOpen: '当前招集', homeAllBanners: '全部招集 ›', homeEvents: '进行中的活动', // draft
  homeSkin: '衣装', // game: interfaceLan_interface_gotoLan_1011
  homeChar: '器者', // game: interfaceLan_interface_nameLan_1003
  homeLeft: '剩余', homeLeftLc: '剩余', homeReleases: '新上线', homeNew: '新', // draft
  homeTheme: '主题活动', // draft
  bnTitle: '招集', bnLoadErr: '招集数据加载失败', bnOpen: '进行中', bnAll: '全部招集', bnUnit: '个招集', // draft
  bnType: '类型', bnYear: '年份', bnNoMatch: '没有符合筛选的招集。', bnEnded: '已结束 · 等待更新', // draft
  bnChoice: '{n}位器者自选', bnCue: '查看器者 ›', bnVersion: '版本 {n}', // draft
  tmDH: '{d}天{h}小时', tmHM: '{h}小时{m}分', tmM: '{m}分钟', tmLt: '不到1分钟', // draft
  skAllSrc: '全部来源', // draft
  skTicket: '衣装券', // game: itemsLan_items_nameLan_8
  skHigh: '高级', // draft
  skTravel: '游历', // game: interfaceLan_interface_nameLan_9001
  skEvent: '活动', // game: LangGlobalLan_LangGlobal_name_2481
  skShop: '衣装店', // game: characterlan_characterSkin_getdescriptionLan_* 通过衣装店限时销售
  skTraining: '集训易市', // game: characterlan_characterSkin_getdescriptionLan_S0155003
  skStory: '剧情', // game: LangGlobalLan_LangGlobal_name_7198
  skFree: '免费', // game: UIShopSkinItem_UI_0
  sortDate: '最近上线', // draft
  sortName: '衣装名称 (A-Z)', // draft
  sortChar: '器者名称 (A-Z)', // draft
  sortPrice: '券价 (低到高)', // draft
  sortId: '按衣装编号', // draft
  skPrice: '价格：{p} {c}', // draft
  skHighFull: '高级衣装（礼包限量发售）', // draft
  skFullStory: '通关剧情后解锁', // draft
  skFullTraining: '通过集训易市获得', // game: characterlan_characterSkin_getdescriptionLan_S0155003
  skFullTravel: '通过游历获得', // game: characterlan_characterSkin_getdescriptionLan_S0149003
  skFullZhenji: '通过珍集易市获得', // game: characterlan_characterSkin_getdescriptionLan_V0075004
  skFullShop: '通过衣装店限时销售', // game: characterlan_characterSkin_getdescriptionLan_V0034101
  skFullBook: '通过预约奖励获得', // game: characterlan_characterSkin_getdescriptionLan_A0003003
  skFullHuaChao: '通过花朝昔时活动获得', // game: characterlan_characterSkin_getdescriptionLan_V0049003
  skFullXieYun: '通过协韵行歌活动获得', // game: characterlan_characterSkin_getdescriptionLan_V0065071
  skFullEvent: '通过活动获得', // game: characterlan_characterSkin_getdescriptionLan_D0045003
  skFullFree: '彩蛋赠送', // game: characterlan_characterSkin_getdescriptionLan_V0008003
  skFullOther: '特殊获取方式', // draft
  skObtainDefault: '商店 / 活动发售', // draft
  skObtainGift: '礼包发售', // draft
  skLimitedPrice: '限定', // game: LangGlobalLan_LangGlobal_name_2497
  skLoading: '正在加载衣装图库数据...', // draft
  skAllChars: '全部器者', // draft
  skMuseum: '物华弥新博物馆 • 衣装图库', // draft
  skTitle: '器者衣装收藏', // draft
  skIntro: '探索145款特别衣装，记录历史典故、四时风物与千年古物之美。', // draft
  skHeroAria: '高级衣装焦点展览', // draft
  skAppraisal: '鉴定档案', // draft
  skSpotBadge: '高级焦点', // draft
  skSeriesOf: '衣装系列：{n}', // draft
  skSeriesLogo: '衣装系列标志', // draft
  skObtain: '获取途径', // game: HeroSkinPanel_UI_6
  skFactoryPrice: '出厂价', // draft
  skViewDetail: '查看衣装详情', // draft
  skViewDetailN: '查看衣装详情 {n}', // draft
  skSpotNav: '高级焦点导航', // draft
  skSpotPrev: '上一个焦点衣装', // draft
  skSpotNext: '下一个焦点衣装', // draft
  skSpotProgress: '焦点进度', // draft
  skSpotGo: '跳转到焦点 {n}', // draft
  skZoomDrawing: '点击查看大图（立绘）', // draft
  skZoomHero: '查看焦点衣装大图', // draft
  skSpotExhibit: '展览焦点', // draft
  skToolbar: '衣装筛选与搜索', // draft
  skSearch: '按衣装、器者名称搜索...', // draft
  skFilterChar: '按器者筛选', // draft
  skSortAria: '衣装排序', // draft
  skAcqTitle: '获取途径', // game: HeroSkinPanel_UI_6
  skSeriesTitle: '衣装系列', // draft
  skCabinet: '衣装系列柜', // draft
  skAllSeries: '全部系列 ({n})', // draft
  skGridLabel: '衣装列表', // draft
  skZoomAria: '查看大图', // draft
  skCloseEsc: '关闭 (Escape)', // draft
  skZoomAlt: '衣装大图', // draft
  skCount: '显示 {n} / {m} 款衣装', // draft
  skNoMatch: '没有符合筛选的衣装。', // draft
  skTicketAlt: '券', // draft
  skHighDash: '高级衣装 - ', // draft
  skHighAlt: '高级衣装', // draft
  skLoreDefault: '仿照杰作神韵而制，笔意清逸，神态庄严，尽显传统绘画的巅峰风韵。', // draft
  sdLoading: '正在加载衣装数据...', // draft
  sdNotFound: '未找到衣装', // draft
  sdNotFoundText: '衣装编号“{id}”不存在或尚未上线。', // draft
  sdBack: '← 返回衣装图库', // draft
  sdLibrary: '衣装图库', // draft
  sdEventFree: '活动 / 免费', // draft
  sdNoInfo: '暂无信息', // draft
  sdNav: '衣装导航', // draft
  sdHeroAria: '衣装焦点图', // draft
  sdZoomHint: '点击查看大图', // draft
  sdDossier: '衣装鉴定档案', // draft
  sdOwner: '所属器者：', // draft
  sdCost: '费用 / 货币：', // draft
  sdRelease: '发布时间：', // draft
  sdClass: '衣装分类：', // draft
  sdHighType: '高级互动衣装', // draft
  sdNormalType: '普通衣装', // draft
  sdSeries: '衣装系列：', // draft
  sdCv: '配音演员 (CV)：', // draft
  sdAssets: '图像资源', // draft
  sdDrawing: '全身立绘 (Drawing)', // draft
  sdDrawingSub: '高清全身图 • 点击全屏查看', // draft
  sdDrawingAria: '查看全身立绘大图', // draft
  sdCard: '卡面 (Card)', // draft
  sdCardSub: '查阅界面中的卡面样式 • 点击查看', // draft
  sdCardAria: '查看卡面大图', // draft
  sdAvatar: '头像 (Avatar)', // draft
  sdAvatarSub: '器者穿上衣装后的头像 • 点击查看', // draft
  sdAvatarAria: '查看头像大图', // draft
  trTitle: '强度榜汇总', trRef: '参考强度榜：', trUpdated: '更新于', trOld: '旧版', trTabs: '强度榜内容', // draft
  trTabChars: '器者', // game: interfaceLan_interface_nameLan_1003
  trTabTeams: '阵容', trTabInfo: '说明', trSearch: '搜索器者', trSearchAria: '按名称搜索器者', // draft
  trCount: '{n} 位器者', trLeft: '剩余 {n} 位器者', trNoMatch: '没有符合的器者。', trMissing: '未找到该强度榜。', // draft
  trSeeAll: '查看全部强度榜', trNone: '暂无强度榜。', trLegZ: '最低致知阶段', trLegHc: '需要焕彰', // draft
  ifBannerDesc: '当前招集、倒计时与全部往期招集。', ifWeapons: '武器', // draft
  ifWeaponsDesc: '武器、技能与属性词条。', ifMusicDesc: '游戏背景音乐，在线试听。', ifSoon: '开发中', wpPlaceholder: '内容仍在构思中，敬请期待。', // draft
  cChangeChar: '更换器者', cAvatarTitle: '点击选择器者', cAvatarAria: '选择器者', // draft
  cLevel: '等级', // game: HeroPackagePanel_UI_4
  cLevelMax: '最高 120', cCur: '当前', cReport: '资源报告', cExp: '经验', // draft
  cMats: '所需材料', cNoMats: '该区间无需资源。', cVan: '万', // draft
  cFooter: '物华弥新计算器为非商业性质的粉丝自制项目，与官方发行商无关。与物华弥新相关的图像、名称及游戏资产归各自所有者所有。', // draft
  bdDeepens: '深造', // game: interfaceLan_interface_nameLan_1110
  bdAffixes: '属性词条', bdNoReroll: '无需洗炼武器。', bdSeeTalents: '查看深造 ›', // draft
  bdPoints: '{n}/11 点', bdRotation: '输出循环', bdTips: '技巧', bdSeeSkills: '查看技能 ›', // draft
  mnEmpty: '未找到。试试中文名或去掉声调。', ldErr: '数据加载失败', ldErrText: '请检查网络连接后刷新页面。', // draft
  trLegRest: '无标签 = 无需阶段 · 同一档内越靠左越强 · 点击查看配装', // draft
  catSortHp: '生命值', // game: characterlan_AttrDes_namelan_Hp_FIX
  catSortAtk: '攻击力', // game: characterlan_AttrDes_namelan_Atk
  catSortDef: '物理防御', // game: characterlan_AttrDes_namelan_PhysicDef
  catSortRes: '构素防御', // game: characterlan_AttrDes_namelan_MagicDef
  navMusic: '音乐', muTitle: '音乐', muAll: '全部', muNew: '最新更新', muJukebox: '唱片机', muStory: '剧情', muStage: '战斗', muArea: '地图',
  muOther: '其他', muSearch: '按曲名搜索', muEmpty: '没有符合的曲目。', muLoadError: '曲目列表加载失败。',
  muPlayError: '无法播放此曲目。', muSource: '获取方式', muUsedEvent: '活动使用', muEvent: '活动', muUsedStory: '剧情使用', muUsedStage: '关卡使用', muUsedArea: '地图使用',
  muMore: '另有 {n} 关', // draft
  muLede: '共 {n} 首游戏背景音乐，版本 {v}。', muClear: '清除搜索', muRetry: '重试', muPlay: '播放', muPause: '暂停', // draft
  muMute: '静音', muUnmute: '取消静音', muVolume: '音量', muSeek: '进度', muPrev: '上一首', muNext: '下一首', // draft
  muScenes: '{n} 段', muScenesTotal: '共 {n} 段剧情', muNoUse: '尚未找到游戏中使用此曲的位置。', // draft
};
export const strings: Record<Lang, Record<StringKey, string>> = { vi, cn };
export const s = (key: StringKey, l: Lang = getLang()) => strings[l][key];
