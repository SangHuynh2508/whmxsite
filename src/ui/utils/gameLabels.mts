// Display labels for raw game codes, shared by the public views (character job, rarity).
import { s } from '../../i18n/strings.mts';
export const JOB_NAMES: Record<number, string> = { 1: 'Túc Vệ', 2: 'Khinh Nhuệ', 3: 'Viễn Kích', 4: 'Cấu Thuật', 5: 'Chiến Lược' };
// Language-aware job label; '' for unknown codes. JOB_NAMES stays VI for the admin.
export const jobName = (j: number): string => (JOB_NAMES[j] ? s(`job${j}` as 'job1') : '');
export const RARITY_LABELS: Record<number, string> = { 5: 'EXTRA', 4: 'SSR', 3: 'SR', 2: 'R', 1: 'N' };
