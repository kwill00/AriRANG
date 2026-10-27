import { createContext, useCallback, useContext } from 'react'
import { messages } from './translations'
import { extraMessages } from './translations-extra'
import { feedbackMessages } from './translations-feedback'
import { youthMessages } from './translations-youth'
import { homeMessages } from './translations-home'
export type Language = 'es' | 'en' | 'ko' | 'pt' | 'ja'
export const languages: Record<Language, string> = { es: 'Español', en: 'English', ko: '한국어', pt: 'Português', ja: '日本語' }
export const LocaleContext = createContext<Language>('es')
export function translate(text: string, language: Language, values?: Record<string, string | number>): string {
  const translated = language === 'es' ? text : (messages[text] ?? extraMessages[text] ?? feedbackMessages[text] ?? youthMessages[text] ?? homeMessages[text])?.[(['en', 'ko', 'pt', 'ja'] as Language[]).indexOf(language)] ?? text
  return values ? translated.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match) : translated
}
export function useT() {
  const language = useContext(LocaleContext)
  return useCallback((text: string, values?: Record<string, string | number>) => translate(text, language, values), [language])
}
export function useLanguage() { return useContext(LocaleContext) }
