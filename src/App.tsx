
import { useState, useEffect } from 'react'
import './App.css'


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
  const datosGuardados = localStorage.getItem('armyTravelViaje')

  if (datosGuardados) {
    try {
      const viaje = JSON.parse(datosGuardados)

      setOrigen(viaje.origen ?? '')
      setDestino(viaje.destino ?? '')
      setFechaSalida(viaje.fechaSalida ?? '')
      setFechaConcierto(viaje.fechaConcierto ?? '')
      setFechaRegreso(viaje.fechaRegreso ?? '')

      setEntrada(Number(viaje.entrada ?? 0))
      setTransporte(Number(viaje.transporte ?? 0))
      setHotel(Number(viaje.hotel ?? 0))
      setAhorrado(Number(viaje.ahorrado ?? 0))

    } catch (error) {
      console.error('Error al recuperar el viaje:', error)
    }
  }
}, [])


useEffect(() => {
  try {
    const datos = localStorage.getItem('armyTravelViajes')

    if (datos) {
      const lista = JSON.parse(datos)

      if (Array.isArray(lista)) {
        setViajes(lista)
      }
    } else {
      const anterior = localStorage.getItem('armyTravelViaje')

      if (anterior) {
        const viajeAnterior = JSON.parse(anterior)

        const primerViaje: Viaje = {
          ...viajeAnterior,
          id: crypto.randomUUID()
        }

        setViajes([primerViaje])

        localStorage.setItem(
          'armyTravelViajes',
          JSON.stringify([primerViaje])
        )
      }
    }
  } catch (error) {
    console.error('Error recuperando viajes:', error)
  }
}, [])



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




const guardarViaje = () => {
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

  const listaActualizada = viajeEditandoId
    ? viajes.map((v) =>
        v.id === viajeEditandoId ? viaje : v
      )
    : [...viajes, viaje]

  setViajes(listaActualizada)

  localStorage.setItem(
    'armyTravelViajes',
    JSON.stringify(listaActualizada)
  )

  setViajeEditandoId(null)

  alert('💜 ¡Viaje guardado correctamente!')
}


const editarViaje = (viaje: Viaje) => {
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

const eliminarViaje = (id: string) => {
  const confirmar = window.confirm(
    '¿Seguro que querés eliminar este viaje?'
  )

  if (!confirmar) return

  const listaActualizada = viajes.filter(
    (viaje) => viaje.id !== id
  )

  setViajes(listaActualizada)

  localStorage.setItem(
    'armyTravelViajes',
    JSON.stringify(listaActualizada)
  )

  if (viajeEditandoId === id) {
    setViajeEditandoId(null)
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


  return (
    <main className="app">
      <header>
        <h2>💜 ARMY Travel</h2>
        <p>Your concert journey starts here</p>
      </header>

      <section className="hero">
        <h1>Tu próximo concierto comienza aquí</h1>
        <p>Planificá tu viaje y controlá tu presupuesto.</p>
      </section>


<section className="travel-form">
  <h2>📍 Mi próximo viaje</h2>

  <label htmlFor="origen">Ciudad de origen</label>
  <input
    id="origen"
    type="text"
    value={origen}
    onChange={(e) => setOrigen(e.target.value)}
    placeholder="Ej: Bariloche"
  />

  <label htmlFor="destino">Ciudad de destino</label>
  <input
    id="destino"
    type="text"
    value={destino}
    onChange={(e) => setDestino(e.target.value)}
    placeholder="Ej: Buenos Aires"
  />

  <label htmlFor="salida">Fecha de salida</label>
  <input
    id="salida"
    type="date"
    value={fechaSalida}
    onChange={(e) => setFechaSalida(e.target.value)}
  />

  <label htmlFor="concierto">Fecha del concierto</label>
  <input
    id="concierto"
    type="date"
    value={fechaConcierto}
    onChange={(e) => setFechaConcierto(e.target.value)}
  />

  <input
  id="regreso"
  type="date"
  min={fechaConcierto || fechaSalida || undefined}
  value={fechaRegreso}
  onChange={(e) => setFechaRegreso(e.target.value)}
/>

  <div className="trip-summary">
    <h3>✈️ Resumen del viaje</h3>
    <p>
      <strong>Ruta:</strong> {origen || 'Sin origen'}
      {' → '}
      {destino || 'Sin destino'}
    </p>
    <p>
      <strong>Salida:</strong> {fechaSalida || 'Sin definir'}
    </p>
    <p>
      <strong>Concierto:</strong> {fechaConcierto || 'Sin definir'}
    </p>
    <p>
      <strong>Regreso:</strong> {fechaRegreso || 'Sin definir'}
    </p>
    {fechaSalida && fechaConcierto && fechaRegreso &&
      (fechaSalida > fechaConcierto ||
       fechaConcierto > fechaRegreso) && (
        <p role="alert" className="date-error">
          Revisá las fechas: el concierto debe estar
          entre la salida y el regreso.
        </p>
      )}
  </div>
</section>



      <section className="calculator">
        <h2>✈️ Mi presupuesto</h2>

        <label>Entrada (USD)</label>
        <input
          type="number"
          min="0"
          value={entrada}
          onChange={(e) => setEntrada(Math.max(0, Number(e.target.value)))}
        />

        <label>Transporte (USD)</label>
        <input
          type="number"
          min="0"
          value={transporte}
          onChange={(e) => setTransporte(Math.max(0, Number(e.target.value)))}
        />

        <label>Alojamiento (USD)</label>
        <input
          type="number"
          min="0"
          value={hotel}
          onChange={(e) => setHotel(Math.max(0, Number(e.target.value)))}
        />

        <div className="total">
          <p>Presupuesto estimado</p>
          <h2>US$ {total.toLocaleString()}</h2>
        </div>
      </section>


<section className="savings">
  <h2>💰 Mi plan de ahorro</h2>

  <label htmlFor="ahorrado">Dinero ahorrado (USD)</label>
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
    <p>Objetivo total</p>
    <h2>US$ {total.toLocaleString()}</h2>

    <div className="progress-bar">
      <div style={{ width: `${progreso}%` }} />
    </div>

    <p>{progreso.toFixed(0)}% ahorrado</p>

    
  
    <p>Te faltan: US$ {pendiente.toFixed(2)}</p>

    {fechaObjetivo && diasRestantes > 0 ? (
      <>
        <p>Días disponibles: {diasRestantes}</p>
        <h3>
          Ahorrá US$ {ahorroDiario.toFixed(2)} por día
        </h3>
      </>
    ) : (
      <p>
        {!fechaObjetivo
          ? 'Seleccioná una fecha de salida.'
          : pendiente === 0
            ? '¡Objetivo de ahorro alcanzado!'
            : 'La fecha de salida ya llegó o pasó.'}
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
      ? '💾 Guardar cambios'
      : '💾 Guardar nuevo viaje'}
  </button>

  <button
    type="button"
    className="new-button"
    onClick={nuevoViaje}
  >
    ➕ Nuevo viaje
  </button>
</div>



<section className="trips-list">
  <h2>💜 Mis viajes guardados</h2>

  {viajes.length === 0 ? (
    <p>Todavía no guardaste ningún viaje.</p>
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
              <strong>Origen:</strong> {viaje.origen}
            </p>

            <p>
              <strong>Concierto:</strong>{' '}
              {viaje.fechaConcierto || 'Sin definir'}
            </p>

            <p>
              <strong>Presupuesto:</strong> US${' '}
              {presupuesto.toLocaleString()}
            </p>

            <div className="progress-bar">
              <div style={{ width: `${progreso}%` }} />
            </div>

            <p>{progreso.toFixed(0)}% ahorrado</p>
<div className="trip-actions">
  <button
    type="button"
    className="edit-button"
    onClick={() => editarViaje(viaje)}
  >
    ✏️ Editar
  </button>

  <button
    type="button"
    className="delete-button"
    onClick={() => eliminarViaje(viaje.id)}
  >
    🗑️ Eliminar
  </button>
</div>

          </article>
        )
      })}
    </div>
  )}
</section>


      <footer>
        ARMY Travel · Made for fans 💜
      </footer>
    </main>
  )
}

export default App
