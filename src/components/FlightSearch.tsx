import { useT } from '../lib/locale'

import { useState } from 'react'
import AirportSearch from './AirportSearch'

type TipoViaje = 'ida-vuelta' | 'solo-ida'

export default function FlightSearch() {
  const t = useT()
  const [tipoViaje, setTipoViaje] =
    useState<TipoViaje>('ida-vuelta')

  const [origenVuelo, setOrigenVuelo] = useState('')
  const [destinoVuelo, setDestinoVuelo] = useState('')
  const [fechaIda, setFechaIda] = useState('')
  const [fechaVuelta, setFechaVuelta] = useState('')
  const [pasajeros, setPasajeros] = useState(1)
  const [mensaje, setMensaje] = useState('')

  const obtenerIATA = (texto: string) => {
    const coincidencia = texto.match(/\(([A-Z]{3})\)$/)
    return coincidencia ? coincidencia[1] : ''
  }

  const buscarVuelos = () => {
    setMensaje('')

    const origenIATA = obtenerIATA(origenVuelo)
    const destinoIATA = obtenerIATA(destinoVuelo)

    if (!origenIATA || !destinoIATA) {
      setMensaje('Seleccioná los aeropuertos de la lista.')
      return
    }

    if (origenIATA === destinoIATA) {
      setMensaje('El origen y destino deben ser diferentes.')
      return
    }

    if (!fechaIda) {
      setMensaje('Seleccioná una fecha de ida.')
      return
    }

    const hoy = new Date()
    const fechaActual = [
      hoy.getFullYear(),
      String(hoy.getMonth() + 1).padStart(2, '0'),
      String(hoy.getDate()).padStart(2, '0')
    ].join('-')

    if (fechaIda < fechaActual) {
      setMensaje('La fecha de ida no puede ser anterior a hoy.')
      return
    }

    if (tipoViaje === 'ida-vuelta') {
      if (!fechaVuelta || fechaVuelta < fechaIda) {
        setMensaje(
          'La fecha de vuelta debe ser igual o posterior a la ida.'
        )
        return
      }
    }

    setMensaje(
      t('✈️ Búsqueda preparada: {origen} → {destino}. No consulta precios ni realiza reservas.', { origen: origenIATA, destino: destinoIATA })
    )
  }

  return (
    <section className="flight-search">
      <h2>{t("✈️ Buscar vuelos")}</h2>
      <p>{t("Esta herramienta prepara tu búsqueda. No consulta precios, disponibilidad ni realiza reservas.")}</p>

      <div className="flight-trip-type">
        <button
          type="button"
          className={tipoViaje === 'ida-vuelta' ? 'active' : ''}
          onClick={() => setTipoViaje('ida-vuelta')}
        >{t("Ida y vuelta")}</button>

        <button
          type="button"
          className={tipoViaje === 'solo-ida' ? 'active' : ''}
          onClick={() => setTipoViaje('solo-ida')}
        >{t("Solo ida")}</button>
      </div>

      <div className="flight-fields">
        <AirportSearch
          etiqueta={t("Aeropuerto de origen")}
          valor={origenVuelo}
          onSeleccionar={setOrigenVuelo}
        />

        <AirportSearch
          etiqueta={t("Aeropuerto de destino")}
          valor={destinoVuelo}
          onSeleccionar={setDestinoVuelo}
        />

        <div className="flight-field">
          <label htmlFor="fecha-ida">{t("Fecha de ida")}</label>
          <input
            id="fecha-ida"
            type="date"
            value={fechaIda}
            onChange={(e) => setFechaIda(e.target.value)}
          />
        </div>

        {tipoViaje === 'ida-vuelta' && (
          <div className="flight-field">
            <label htmlFor="fecha-vuelta">{t("Fecha de vuelta")}</label>
            <input
              id="fecha-vuelta"
              type="date"
              min={fechaIda || undefined}
              value={fechaVuelta}
              onChange={(e) => setFechaVuelta(e.target.value)}
            />
          </div>
        )}

        <div className="flight-field">
          <label htmlFor="pasajeros">{t("Pasajeros")}</label>
          <select
            id="pasajeros"
            value={pasajeros}
            onChange={(e) =>
              setPasajeros(Number(e.target.value))
            }
          >
            {[1, 2, 3, 4, 5, 6].map((numero) => (
              <option key={numero} value={numero}>
                {numero} {numero === 1 ? t("adulto") : t("adultos")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        className="flight-submit"
        onClick={buscarVuelos}
      >{t("🔎 Buscar vuelos")}</button>

      {mensaje && (
        <p className="flight-message" role="status">
          {t(mensaje)}
        </p>
      )}
    </section>
  )
}
