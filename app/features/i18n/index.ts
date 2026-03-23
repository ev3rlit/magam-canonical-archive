import { en } from './locales/en';
import { ko } from './locales/ko';
import type { AppLocale, AppMessages } from './types';

export const APP_DEFAULT_LOCALE: AppLocale = 'ko';

const APP_MESSAGES_BY_LOCALE: Record<AppLocale, AppMessages> = {
  ko,
  en,
};

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'ko' || value === 'en';
}

export function getAppLocale(): AppLocale {
  return APP_DEFAULT_LOCALE;
}

export function getAppMessages(locale: AppLocale = getAppLocale()): AppMessages {
  return APP_MESSAGES_BY_LOCALE[locale];
}
