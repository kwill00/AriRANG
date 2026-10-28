import { useT } from './lib/locale'

import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import Dashboard from './components/Dashboard'
import './App.css'
import ProximoViaje from './components/ProximoViaje'
import AirportSearch from './components/AirportSearch'
import FlightSearch from './components/FlightSearch'
import Login from './components/Login'
import MiPerfil from './components/Miperfil'
import { supabase } from './lib/supabase'
import PanelAdmin from './components/PanelAdmin'
import Proyectos from './components/Proyectos'
import Comunidad from './components/Comunidad'
import DirectorioSocial from './components/DirectorioSocial'
import AvisosSociales from './components/AvisosSociales'
import './theme.css'
import AccessGate from './components/AccessGate'
import { signOutPrivately } from './lib/accountSession'
import GuestPlanner from './components/GuestPlanner'
import NavigationTile from './components/NavigationTile'
import './home.css'


type Viaje = {
  id: string
  origen: string
  destino: string
  fechaSalida: string
  fechaConcierto: string
  fechaRegreso: string
  entrada: number
  transporte: number
  hotel: number
  ahorrado: number
}


function App() {
  const t = useT()
  const [modoVisitante, setModoVisitante] = useState(false)
  const [sesion, setSesion] = useState<Session | null>(null)
  const [verificandoSesion, setVerificandoSesion] = useState(true)
useEffect(() => {
  if (modoVisitante) return
  let activo = true

  supabase.auth.getSession().then(({ data, error }) => {
    if (!activo) return

    if (error) {
      console.error('Error de sesión:', error.message)
    }

    setSesion(data.session)
    setVerificandoSesion(false)
  })

  const { data: { subscription } } =
    supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      if (activo) {
        setSesion(nuevaSesion)
        setVerificandoSesion(false)
      }
    })

  return () => {
    activo = false
    subscription.unsubscribe()
  }
}, [modoVisitante])


  if (modoVisitante) return <GuestPlanner onExit={() => { setVerificandoSesion(true); setModoVisitante(false) }} />
  if (verificandoSesion) return <p>{t("💜 Verificando sesión...")}</p>
  if (!sesion) return <Login onGuest={() => setModoVisitante(true)} />
  return <AccessGate key={sesion.user.id} onGuest={() => setModoVisitante(true)}><AplicacionAutenticada sesion={sesion} /></AccessGate>
}

function AplicacionAutenticada({ sesion }: { sesion: Session }) {
  const t = useT()

const [esAdministrador, setEsAdministrador] = useState(false)
const [verificandoAdmin, setVerificandoAdmin] = useState(true)

useEffect(() => {
  let activo = true

  const comprobarAdmin = async () => {
    setEsAdministrador(false)
    setVerificandoAdmin(true)

    if (!sesion?.user.id) {
      if (activo) setVerificandoAdmin(false)
      return
    }

    const { data, error } = await supabase.rpc('es_admin')

    if (!activo) return

    if (error) {
      console.error('Error verificando administrador:', error.message)
    }

    setEsAdministrador(!error && data === true)
    setVerificandoAdmin(false)
  }

  void comprobarAdmin()

  return () => {
    activo = false
  }
}, [sesion?.user.id])

const [menuAbierto, setMenuAbierto] = useState(false)
const [proyectoComunidad, setProyectoComunidad] = useState<string | null>(null)
const [paginaSolicitada, setPagina] = useState<
  'inicio' | 'comunidad' | 'social' | 'viajes' | 'crear' | 'vuelos' | 'proyectos' | 'perfil' | 'admin'
>(new URLSearchParams(window.location.search).has('checkout_test') ? 'admin' : new URLSearchParams(window.location.search).has('comunidad') ? 'comunidad' : 'inicio')
  const [entrada, setEntrada] = useState(250)
  const [transporte, setTransporte] = useState(350)
  const [hotel, setHotel] = useState(200)

  const [origen, setOrigen] = useState('Bariloche')
const [destino, setDestino] = useState('Buenos Aires')

const [fechaSalida, setFechaSalida] = useState('')
const [fechaConcierto, setFechaConcierto] = useState('')
const [fechaRegreso, setFechaRegreso] = useState('')

  const total = entrada + transporte + hotel
  const [ahorrado, setAhorrado] = useState(0)

  const [viajes, setViajes] = useState<Viaje[]>([])

  const [viajeEditandoId, setViajeEditandoId] =
  useState<string | null>(null)






useEffect(() => {
  let activo = true

  const cargarViajes = async () => {
    const { data, error } = await supabase
      .from('viajes')
      .select('*')
      .eq('usuario_id', sesion.user.id)
      .order('creado_en', { ascending: true })

    if (!activo) return

    if (error) {
      console.error('Error al cargar viajes:', error.message)
      return
    }

    const viajesCargados: Viaje[] = (data ?? []).map(
      (registro) => ({
        id: registro.id,
        origen: registro.origen,
        destino: registro.destino,
        fechaSalida: registro.fecha_salida,
        fechaConcierto: registro.fecha_concierto,
        fechaRegreso: registro.fecha_regreso,
        entrada: Number(registro.entrada),
        transporte: Number(registro.transporte),
        hotel: Number(registro.hotel),
        ahorrado: Number(registro.ahorrado)
      })
    )

    setViajes(viajesCargados)
  }

  void cargarViajes()

  return () => {
    activo = false
  }
}, [sesion?.user.id])




  const pendiente = Math.max(0, total - ahorrado)

const hoy = new Date()

const fechaObjetivo = fechaSalida
  ? new Date(`${fechaSalida}T00:00:00`)
  : null

const diasRestantes = fechaObjetivo
  ? Math.max(0, Math.ceil(
      (fechaObjetivo.getTime() - hoy.getTime()) /
      (1000 * 60 * 60 * 24)
    ))
  : 0

const ahorroDiario = diasRestantes > 0
  ? pendiente / diasRestantes
  : 0

const progreso = total > 0
  ? Math.min(100, (ahorrado / total) * 100)
  : 100



const guardarViajeEnSupabase = async (viaje: Viaje) => {
  if (!sesion?.user.id) {
    throw new Error('Tenés que iniciar sesión.')
  }

  const { error } = await supabase
    .from('viajes')
    .upsert({
      id: viaje.id,
      usuario_id: sesion.user.id,
      origen: viaje.origen,
      destino: viaje.destino,
      fecha_salida: viaje.fechaSalida,
      fecha_concierto: viaje.fechaConcierto,
      fecha_regreso: viaje.fechaRegreso,
      entrada: viaje.entrada,
      transporte: viaje.transporte,
      hotel: viaje.hotel,
      ahorrado: viaje.ahorrado
    }, {
      onConflict: 'id'
    })

  if (error) {
    throw new Error(error.message)
  }
}



const guardarViaje = async () => {
  const viaje: Viaje = {
    id: viajeEditandoId ?? crypto.randomUUID(),
    origen,
    destino,
    fechaSalida,
    fechaConcierto,
    fechaRegreso,
    entrada,
    transporte,
    hotel,
    ahorrado
  }

  try {
    await guardarViajeEnSupabase(viaje)

    const listaActualizada = viajeEditandoId
      ? viajes.map((v) =>
          v.id === viajeEditandoId ? viaje : v
        )
      : [...viajes, viaje]

    setViajes(listaActualizada)

    setViajeEditandoId(null)
    setPagina('viajes')

    alert(t('💜 ¡Viaje guardado en Supabase!'))
  } catch (error) {
    console.error('Error al guardar viaje:', error)

    alert(
      error instanceof Error
        ? t(error.message)
        : t('No se pudo guardar el viaje.')
    )
  }
}



const editarViaje = (viaje: Viaje) => {
  setPagina('crear')
  setViajeEditandoId(viaje.id)

  setOrigen(viaje.origen)
  setDestino(viaje.destino)
  setFechaSalida(viaje.fechaSalida)
  setFechaConcierto(viaje.fechaConcierto)
  setFechaRegreso(viaje.fechaRegreso)

  setEntrada(viaje.entrada)
  setTransporte(viaje.transporte)
  setHotel(viaje.hotel)
  setAhorrado(viaje.ahorrado)

  window.scrollTo({ top: 0, behavior: 'smooth' })
}


const eliminarViaje = async (id: string) => {
  const confirmar = window.confirm(
    t('¿Seguro que querés eliminar este viaje?')
  )

  if (!confirmar) return

  if (!sesion?.user.id) {
    alert(t('Tenés que iniciar sesión.'))
    return
  }

  try {
    const { data, error } = await supabase
      .from('viajes')
      .delete()
      .eq('id', id)
      .eq('usuario_id', sesion.user.id)
      .select('id')

    if (error) {
      throw new Error(error.message)
    }

    if (!data || data.length === 0) {
      throw new Error(
        'No se encontró el viaje o no tenés permiso para eliminarlo.'
      )
    }

    setViajes((actuales) =>
      actuales.filter((viaje) => viaje.id !== id)
    )

    if (viajeEditandoId === id) {
      setViajeEditandoId(null)
    }

    alert(t('💜 Viaje eliminado correctamente.'))
  } catch (error) {
    console.error('Error al eliminar viaje:', error)

    alert(
      error instanceof Error
        ? t(error.message)
        : t('No se pudo eliminar el viaje.')
    )
  }
}


const nuevoViaje = () => {
  setViajeEditandoId(null)
  setOrigen('')
  setDestino('')
  setFechaSalida('')
  setFechaConcierto('')
  setFechaRegreso('')
  setEntrada(0)
  setTransporte(0)
  setHotel(0)
  setAhorrado(0)

  window.scrollTo({ top: 0, behavior: 'smooth' })
}


const presupuestoGlobal = viajes.reduce(
  (acumulado, viaje) =>
    acumulado +
    viaje.entrada +
    viaje.transporte +
    viaje.hotel,
  0
)

const ahorradoGlobal = viajes.reduce(
  (acumulado, viaje) =>
    acumulado + Math.min(
      Math.max(0, viaje.ahorrado),
      viaje.entrada + viaje.transporte + viaje.hotel
    ),
  0
)
const pagina = paginaSolicitada === 'admin' && !verificandoAdmin && !esAdministrador
  ? 'inicio'
  : paginaSolicitada

  return (
    <main className="app">

<div className="app-navigation">
<div className="mobile-nav-header"><span>💜 ARMY World</span><button type="button" aria-expanded={menuAbierto} aria-controls="app-menu" onClick={() => setMenuAbierto(v => !v)}>{menuAbierto ? t("Cerrar menú") : t("Abrir menú")}</button></div>
<nav id="app-menu" className={`app-nav nav-gallery ${menuAbierto ? 'is-open' : ''}`} aria-label={t("Navegación principal")} onClick={e => { if (e.target instanceof Element && e.target.closest('button')) { setMenuAbierto(false); window.scrollTo({ top: 0, behavior: 'auto' }) } }}>
<NavigationTile label={t('🏠 Inicio')} art="home" active={pagina === 'inicio'} onClick={() => setPagina('inicio')} />
<NavigationTile label={t('✈️ Mis viajes')} art="trip" active={pagina === 'viajes'} onClick={() => setPagina('viajes')} />
<NavigationTile label={t('➕ Crear viaje')} art="create" active={pagina === 'crear'} onClick={() => setPagina('crear')} />
<NavigationTile label={t('✈️ Buscar vuelos')} art="flight" active={pagina === 'vuelos'} onClick={() => setPagina('vuelos')} />
<NavigationTile label={t('🎤 Proyectos')} art="project" active={pagina === 'proyectos'} onClick={() => setPagina('proyectos')} />
<NavigationTile label={t('💜 Comunidad')} art="community" active={pagina === 'comunidad'} onClick={() => { setProyectoComunidad(null); setPagina('comunidad') }} />
<NavigationTile label={t('👥 ARMY conectadas')} art="people" active={pagina === 'social'} onClick={() => setPagina('social')} />
<NavigationTile label={t('👤 Mi perfil')} art="profile" active={pagina === 'perfil'} onClick={() => setPagina('perfil')} />
{esAdministrador && !verificandoAdmin && <NavigationTile label={t('🛡️ Administración')} art="admin" active={pagina === 'admin'} onClick={() => setPagina('admin')} />}
<NavigationTile label={t('🚪 Cerrar sesión')} art="exit" onClick={async () => {
    const { error } = await signOutPrivately()

    if (error) {
      alert('Error al cerrar sesión: ' + error.message)
    }
  }} />





</nav>
</div>
<AvisosSociales onVerComunidad={() => { setProyectoComunidad(null); setPagina('comunidad') }} />
{pagina === 'social' && <DirectorioSocial usuarioId={sesion.user.id} />}
{pagina === 'admin' && esAdministrador && !verificandoAdmin && (
  <PanelAdmin />
)}
{pagina === 'comunidad' && <Comunidad key={`${sesion.user.id}:${proyectoComunidad ?? 'todos'}`} usuarioId={sesion.user.id} proyectoId={proyectoComunidad} onVerTodo={() => setProyectoComunidad(null)} />}


{pagina === 'perfil' && (
  <MiPerfil
    key={sesion.user.id}
    sesion={sesion}
    cantidadViajes={viajes.length}
  />
)}


{pagina === 'vuelos' && (
  <FlightSearch />
)}

    {pagina === 'proyectos' && (
  <Proyectos key={sesion.user.id} onAbrirProyecto={id => { setProyectoComunidad(id); setPagina('comunidad') }} />
)}

{pagina === 'inicio' && (
  <>
    <Dashboard
      cantidadViajes={viajes.length}
      presupuestoTotal={presupuestoGlobal}
      totalAhorrado={ahorradoGlobal}
      onNavigate={page => { if (page === 'comunidad') setProyectoComunidad(null); setPagina(page); window.scrollTo({ top: 0, behavior: 'auto' }) }}
    />

    <ProximoViaje viajes={viajes} />
  </>
)}




{pagina === 'crear' && (
  <div className="create-page">

<section className="travel-form">
  <h2>{t("📍 Mi próximo viaje")}</h2>

  <AirportSearch
  etiqueta={t("✈️ Aeropuerto de origen")}
  valor={origen}
  onSeleccionar={setOrigen}
/>

 <AirportSearch
  etiqueta={t("📍 Aeropuerto de destino")}
  valor={destino}
  onSeleccionar={setDestino}
/>

  <label htmlFor="salida">{t("Fecha de salida")}</label>
  <input
    id="salida"
    type="date"
    value={fechaSalida}
    onChange={(e) => setFechaSalida(e.target.value)}
  />

  <label htmlFor="concierto">{t("Fecha del concierto")}</label>
  <input
    id="concierto"
    type="date"
    value={fechaConcierto}
    onChange={(e) => setFechaConcierto(e.target.value)}
  />

  <label htmlFor="regreso">{t('Fecha de regreso')}</label>
  <input
  id="regreso"
  type="date"
  min={fechaConcierto || fechaSalida || undefined}
  value={fechaRegreso}
  onChange={(e) => setFechaRegreso(e.target.value)}
/>

  <div className="trip-summary">
    <h3>{t("✈️ Resumen del viaje")}</h3>
    <p>
      <strong>{t("Ruta:")}</strong> {origen || t("Sin origen")}
      {' → '}
      {destino || t("Sin destino")}
    </p>
    <p>
      <strong>{t("Salida:")}</strong> {fechaSalida || t("Sin definir")}
    </p>
    <p>
      <strong>{t("Concierto:")}</strong> {fechaConcierto || t("Sin definir")}
    </p>
    <p>
      <strong>{t("Regreso:")}</strong> {fechaRegreso || t("Sin definir")}
    </p>
    {fechaSalida && fechaConcierto && fechaRegreso &&
      (fechaSalida > fechaConcierto ||
       fechaConcierto > fechaRegreso) && (
        <p role="alert" className="date-error">{t("Revisá las fechas: el concierto debe estar entre la salida y el regreso.")}</p>
      )}
  </div>
</section>



      <section className="calculator">
        <h2>{t("✈️ Mi presupuesto")}</h2>

        <label htmlFor="budget-ticket">{t("Entrada (USD)")}</label>
        <input
          id="budget-ticket"
          type="number"
          min="0"
          value={entrada}
          onChange={(e) => setEntrada(Math.max(0, Number(e.target.value)))}
        />

        <label htmlFor="budget-transport">{t("Transporte (USD)")}</label>
        <input
          id="budget-transport"
          type="number"
          min="0"
          value={transporte}
          onChange={(e) => setTransporte(Math.max(0, Number(e.target.value)))}
        />

        <label htmlFor="budget-hotel">{t("Alojamiento (USD)")}</label>
        <input
          id="budget-hotel"
          type="number"
          min="0"
          value={hotel}
          onChange={(e) => setHotel(Math.max(0, Number(e.target.value)))}
        />

        <div className="total">
          <p>{t("Presupuesto estimado")}</p>
          <h2>US$ {total.toLocaleString()}</h2>
        </div>
      </section>


<section className="savings">
  <h2>{t("💰 Mi plan de ahorro")}</h2>

  <label htmlFor="ahorrado">{t("Dinero ahorrado (USD)")}</label>
  <input
    id="ahorrado"
    type="number"
    min="0"
    value={ahorrado}
    onChange={(e) =>
      setAhorrado(Math.max(0, Number(e.target.value)))
    }
  />

  <div className="savings-summary">
    <p>{t("Objetivo total")}</p>
    <h2>US$ {total.toLocaleString()}</h2>

    <div className="progress-bar">
      <div style={{ width: `${progreso}%` }} />
    </div>

    <p>{progreso.toFixed(0)}{t("% ahorrado")}</p>

    
  
    <p>{t("Te faltan: US$")}{' '}{pendiente.toFixed(2)}</p>

    {fechaObjetivo && diasRestantes > 0 ? (
      <>
        <p>{t("Días disponibles:")}{' '}{diasRestantes}</p>
        <h3>{t("Ahorrá US$")}{' '}{ahorroDiario.toFixed(2)}{t("por día")}</h3>
      </>
    ) : (
      <p>
        {!fechaObjetivo
          ? t("Seleccioná una fecha de salida.")
          : pendiente === 0
            ? t("¡Objetivo de ahorro alcanzado!")
            : t("La fecha de salida ya llegó o pasó.")}
      </p>
    )}
  </div>

  
</section>

<div className="main-actions">
  <button
    type="button"
    className="save-button"
    onClick={guardarViaje}
  >
    {viajeEditandoId
      ? t("💾 Guardar cambios")
      : t("💾 Guardar nuevo viaje")}
  </button>

  <button
    type="button"
    className="new-button"
    onClick={nuevoViaje}
  >{t("➕ Nuevo viaje")}</button>
    
</div>  </div>
)}


{pagina === 'viajes' && (
<section className="trips-list">
  <h2>{t("💜 Mis viajes guardados")}</h2>

  {viajes.length === 0 ? (
    <p>{t("Todavía no guardaste ningún viaje.")}</p>
  ) : (
    <div className="trip-cards">
      {viajes.map((viaje) => {
        const presupuesto =
          viaje.entrada + viaje.transporte + viaje.hotel

        const progreso = presupuesto > 0
          ? Math.min(100, (viaje.ahorrado / presupuesto) * 100)
          : 100
          
        return (
          <article className="trip-card" key={viaje.id}>
            <h3>✈️ {viaje.destino}</h3>

            <p>
              <strong>{t("Origen:")}</strong> {viaje.origen}
            </p>

            <p>
              <strong>{t("Concierto:")}</strong>{' '}
              {viaje.fechaConcierto || t("Sin definir")}
            </p>

            <p>
              <strong>{t("Presupuesto:")}</strong> US${' '}
              {presupuesto.toLocaleString()}
            </p>

            <div className="progress-bar">
              <div style={{ width: `${progreso}%` }} />
            </div>

            <p>{progreso.toFixed(0)}{t("% ahorrado")}</p>
<div className="trip-actions">
  <button
    type="button"
    className="edit-button"
    onClick={() => editarViaje(viaje)}
  >{t("✏️ Editar")}</button>

  <button
    type="button"
    className="delete-button"
    onClick={() => eliminarViaje(viaje.id)}
  >{t("🗑️ Eliminar")}</button>
</div>

          </article>
        )
      })}
    </div>
  )}
</section> )}


      <footer>
        ARMY World · Made for fans 💜
      </footer>
    </main>
  )
}

export default App



