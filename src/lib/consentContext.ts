import { createContext } from 'react'
import type { Consent } from './privacy'
export const ConsentContext = createContext<Consent | null>(null)
