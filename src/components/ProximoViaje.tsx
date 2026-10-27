import { useLanguage, useT } from '../lib/locale'

type ViajeDestacado = {
  id: string
  origen: string
  destino: string
  fechaSalida: string
  fechaConcierto: string
  entrada: number
  transporte: number
  hotel: number
  ahorrado: number
}

type ProximoViajeProps = {
  viajes: ViajeDestacado[]
}

export default function ProximoViaje({
  viajes
}: ProximoViajeProps) {
  const t = useT()
  const language = useLanguage()

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const proximos = viajes
    .filter((viaje) => {
      if (!viaje.fechaConcierto) return false

      const fecha = new Date(
        `${viaje.fechaConcierto}T12:00:00`
      )

      return !isNaN(fecha.getTime()) && fecha >= hoy
    })
    .sort((a, b) =>
      a.fechaConcierto.localeCompare(b.fechaConcierto)
    )

  const viaje = proximos[0]

  if (!viaje) {
    return (
      <section className="next-trip">
        <h2>{t("✈️ Tu próxima aventura")}</h2>
        <p>{t("Todavía no tenés conciertos futuros guardados. Creá un viaje para comenzar.")}</p>
      </section>
    )
  }

  const fecha = new Date(
    `${viaje.fechaConcierto}T12:00:00`
  )

  const diasRestantes = Math.max(
    0,
    Math.ceil(
      (new Date(
        `${viaje.fechaConcierto}T00:00:00`
      ).getTime() - hoy.getTime()) / 86400000
    )
  )

  const presupuesto =
    viaje.entrada + viaje.transporte + viaje.hotel

  const faltante = Math.max(
    0,
    presupuesto - viaje.ahorrado
  )

  const progreso = presupuesto > 0
    ? Math.min(
        100,
        Math.max(0, (viaje.ahorrado / presupuesto) * 100)
      )
    : 100

  return (
    <section className="next-trip">
      <span className="next-trip-label">{t("✈️ TU PRÓXIMA AVENTURA")}</span>

      <h2>{viaje.destino}</h2>
      <p>{t("Desde")}{' '}{viaje.origen}</p>

      <div className="next-trip-details">
        <div>
          <span>{t("Fecha del concierto")}</span>
          <strong>
            {fecha.toLocaleDateString(language, {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </strong>
        </div>

        <div>
          <span>{t("Días restantes")}</span>
          <strong>{diasRestantes}{t("días")}</strong>
        </div>
      </div>

      <p>{t("Progreso de ahorro:")}{' '}{progreso.toFixed(0)}%</p>

      <div className="next-trip-progress">
        <div style={{ width: `${progreso}%` }} />
      </div>

      <p>{t("Te faltan US$")}{faltante.toFixed(2)} {' '}{t("para completar tu presupuesto.")}</p>
    </section>
  )
}
