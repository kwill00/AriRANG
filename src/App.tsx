
import { useState, useEffect } from 'react'
import './App.css'

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
  const viaje = {
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

  localStorage.setItem(
    'armyTravelViaje',
    JSON.stringify(viaje)
  )

  alert('💜 ¡Tu viaje se guardó correctamente!')
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
<button className="save-button" onClick={guardarViaje}>
  💾 Guardar mi viaje
</button>

      <footer>
        ARMY Travel · Made for fans 💜
      </footer>
    </main>
  )
}

export default App
