import { useT } from '../lib/locale'

import { useId, useRef, useState } from 'react'

type Aeropuerto = {
  codigo: string
  ciudad: string
  nombre: string
  pais: string
}

type AirportSearchProps = {
  etiqueta: string
  valor: string
  onSeleccionar: (valor: string) => void
}

const aeropuertos: Aeropuerto[] = [
  {
    codigo: 'BRC',
    ciudad: 'Bariloche',
    nombre: 'Teniente Luis Candelaria',
    pais: 'Argentina'
  },
  {
    codigo: 'EZE',
    ciudad: 'Buenos Aires',
    nombre: 'Ministro Pistarini - Ezeiza',
    pais: 'Argentina'
  },
  {
    codigo: 'AEP',
    ciudad: 'Buenos Aires',
    nombre: 'Aeroparque Jorge Newbery',
    pais: 'Argentina'
  },
  {
    codigo: 'COR',
    ciudad: 'Córdoba',
    nombre: 'Ingeniero Ambrosio Taravella',
    pais: 'Argentina'
  },
  {
    codigo: 'MAD',
    ciudad: 'Madrid',
    nombre: 'Adolfo Suárez Madrid-Barajas',
    pais: 'España'
  },
  {
    codigo: 'BCN',
    ciudad: 'Barcelona',
    nombre: 'Josep Tarradellas Barcelona-El Prat',
    pais: 'España'
  },
  {
    codigo: 'JFK',
    ciudad: 'Nueva York',
    nombre: 'John F. Kennedy',
    pais: 'Estados Unidos'
  },
  {
    codigo: 'ICN',
    ciudad: 'Seúl',
    nombre: 'Incheon International Airport',
    pais: 'Corea del Sur'
  }
]

export default function AirportSearch({
  etiqueta,
  valor,
  onSeleccionar
}: AirportSearchProps) {
  const t = useT()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const [abierto, setAbierto] = useState(false)

  const normalizar = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()

 
const busqueda = normalizar(valor.trim())

const resultados = aeropuertos
  .filter((aeropuerto) => {
    if (!busqueda) return false

    return [
      aeropuerto.codigo,
      aeropuerto.ciudad,
      aeropuerto.nombre,
      aeropuerto.pais
    ].some((campo) =>
      normalizar(campo).includes(busqueda)
    )
  })
  .sort((a, b) => {
    const prioridad = (aeropuerto: Aeropuerto) => {
      if (
        normalizar(aeropuerto.codigo) === busqueda
      ) return 0

      if (
        normalizar(aeropuerto.ciudad).startsWith(busqueda)
      ) return 1

      if (
        normalizar(aeropuerto.codigo).startsWith(busqueda)
      ) return 2

      return 3
    }

    return prioridad(a) - prioridad(b)
  })

  return (
    <div className="airport-search">
      <label htmlFor={inputId}>{etiqueta}</label>

      <input
        id={inputId}
        ref={inputRef}
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        type="text"
        value={valor}
        placeholder={t("Ej: BRC, Madrid, Barcelona...")}
        onChange={(e) => {
          onSeleccionar(e.target.value)
          setAbierto(true)
        }}
        onFocus={() => setAbierto(true)}
        onBlur={e => { if (!e.relatedTarget?.closest('.airport-results')) setAbierto(false) }}
        onKeyDown={e => {
          if (e.key === 'Escape') setAbierto(false)
          if (e.key === 'ArrowDown' && abierto) { e.preventDefault(); resultsRef.current?.querySelector('button')?.focus() }
        }}
        aria-expanded={abierto && valor.trim() !== ''}
        aria-controls={`${inputId}-results`}
      />

      {abierto && valor.trim() !== '' && (
        <div id={`${inputId}-results`} ref={resultsRef} className="airport-results" role="listbox" aria-label={etiqueta} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setAbierto(false) }} onKeyDown={e => {
          if (e.key === 'Escape') { inputRef.current?.focus(); setAbierto(false); return }
          if (['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
            e.preventDefault()
            const options = Array.from(e.currentTarget.querySelectorAll('button'))
            const index = options.indexOf(e.target as HTMLButtonElement)
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
            options[next]?.focus()
          }
        }}>
          {resultados.length > 0 ? (
            resultados.slice(0, 5).map((aeropuerto) => (
              <button
                type="button"
                role="option"
                aria-selected={valor === `${aeropuerto.ciudad} (${aeropuerto.codigo})`}
                key={aeropuerto.codigo}
                className="airport-option"
                onFocus={() => setAbierto(true)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSeleccionar(
                    `${aeropuerto.ciudad} (${aeropuerto.codigo})`
                  )
                  inputRef.current?.focus()
                  setAbierto(false)
                }}
              >
                <strong>
                  ✈️ {aeropuerto.codigo} — {aeropuerto.ciudad}
                </strong>

                <span>
                  {aeropuerto.nombre}, {aeropuerto.pais}
                </span>
              </button>
            ))
          ) : (
            <p className="airport-empty">{t("No encontramos aeropuertos con ese nombre.")}</p>
          )}
        </div>
      )}
    </div>
  )
}
