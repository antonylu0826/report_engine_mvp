import { zhTW, type Messages } from './zh-TW';
import { en } from './en';
import type { AppLocale } from '../config';

export const allMessages: Record<AppLocale, Messages> = {
  'zh-TW': zhTW,
  en,
};

export type { Messages };
