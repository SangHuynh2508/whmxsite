import { getLang, type Lang } from './lang.mts';

const vi = {
  navCharacters: 'Khí Giả', navTier: 'Tier List', navSkins: 'Trang Phục', navInfo: 'Thông tin', navTools: 'Công cụ',
  navAdmin: 'Quản trị', navLogin: 'Đăng nhập', navLang: 'Ngôn ngữ',
  navAccount: 'Tài khoản', navLogout: 'Đăng xuất', menuClose: 'Đóng menu',
  searchPlaceholder: 'Tìm Khí Giả hoặc trang phục', navRail: 'Thanh điều hướng ứng dụng',
};
export type StringKey = keyof typeof vi;
const cn: Record<StringKey, string> = {
  navCharacters: '器者', navTier: '强度榜', // draft
  navSkins: '装束', navInfo: '资料', // draft
  navTools: '工具', // draft
  navAdmin: '管理', navLogin: '登录', navLang: '语言', // draft
  navAccount: '账号', navLogout: '退出登录', menuClose: '关闭菜单', // draft
  searchPlaceholder: '搜索器者或装束', navRail: '应用导航栏', // draft
};
export const strings: Record<Lang, Record<StringKey, string>> = { vi, cn };
export const s = (key: StringKey, l: Lang = getLang()) => strings[l][key];
