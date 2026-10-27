import { useLanguage, useT } from '../lib/locale'
import TravelIllustration, { JourneyScene } from './TravelIllustration'

type DashboardProps = {
  cantidadViajes: number
  presupuestoTotal: number
  totalAhorrado: number
  onNavigate: (page: 'crear' | 'viajes' | 'proyectos' | 'comunidad') => void
}

export default function Dashboard({
  cantidadViajes,
  presupuestoTotal,
  totalAhorrado,
  onNavigate
}: DashboardProps) {
  const t = useT()
  const language = useLanguage()

  const progreso = presupuestoTotal > 0
    ? Math.min(
        100,
        (totalAhorrado / presupuestoTotal) * 100
      )
    : 0

  const moneda = (valor: number) =>
    valor.toLocaleString(language, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    })

  return (
    <section className="dashboard">
      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
        <span>{t("MI PANEL DE VIAJES")}</span>
        <h1>{t("¡Tu próxima aventura comienza aquí! 💜")}</h1>
        <p>{t("Organizá tus conciertos, presupuestos y metas de ahorro desde un solo lugar.")}</p>
        </div>
        <div className="dashboard-hero-art"><JourneyScene /></div>
      </div>

      <section className="home-shortcuts" aria-labelledby="home-shortcuts-title">
        <div className="home-section-heading"><h2 id="home-shortcuts-title">{t('¿Qué hacemos hoy?')}</h2><span>{t('Tu próximo paso empieza acá')}</span></div>
        <div className="home-shortcut-grid">
          {([
            { page: 'crear', art: 'create', title: 'Planificar un viaje', description: 'Dale forma a tu próxima aventura' },
            { page: 'viajes', art: 'trip', title: 'Ver mis viajes', description: 'Tus planes, en un solo lugar' },
            { page: 'proyectos', art: 'project', title: 'Crear una propuesta', description: 'Una idea para compartir con ARMY' },
            { page: 'comunidad', art: 'community', title: 'Ir a la comunidad', description: 'Ideas y conversaciones entre fans' },
          ] as const).map(item => <button key={item.page} type="button" className={`home-shortcut home-shortcut--${item.art}`} aria-label={t(item.title)} onClick={() => onNavigate(item.page)}>
            <span className="shortcut-art"><TravelIllustration kind={item.art} /></span>
            <span className="shortcut-copy"><strong>{t(item.title)}</strong><span>{t(item.description)}</span></span>
            <span className="shortcut-arrow" aria-hidden="true">↗</span>
          </button>)}
        </div>
      </section>

      <div className="dashboard-grid">
        <article className="dashboard-stat">
          <span>{t("✈️ Viajes guardados")}</span>
          <strong>{cantidadViajes}</strong>
        </article>

        <article className="dashboard-stat">
          <span>{t("💳 Presupuesto total")}</span>
          <strong>{moneda(presupuestoTotal)}</strong>
        </article>

        <article className="dashboard-stat">
          <span>{t("💰 Total ahorrado")}</span>
          <strong>{moneda(totalAhorrado)}</strong>
        </article>

        <article className="dashboard-stat">
          <span>{t("🎯 Progreso global")}</span>
          <strong>{progreso.toFixed(0)}%</strong>
        </article>
      </div>
    </section>
  )
}
