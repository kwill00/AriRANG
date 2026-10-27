import { useT } from '../lib/locale'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { AgeChoice, AgeNotice, TeenNotice, PolicyChoices } from './AccessGate'
import { POLICY_VERSION } from '../lib/privacy'
import TravelIllustration from './TravelIllustration'

type Modo = 'login' | 'registro' | 'recuperar'

export default function Login({ onGuest }: { onGuest?: () => void }) {
  const t = useT()
  const [modo, setModo] = useState<Modo>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)
  const [edad, setEdad] = useState('')
  const [terminos, setTerminos] = useState(false)
  const [privacidad, setPrivacidad] = useState(false)
  const puedeRegistrarse = edad === 'adult' || edad === 'teen'

  const ingresarConGoogle = async () => {
    setMensaje(''); setCargando(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'https://armytravellatam.com/', queryParams: { prompt: 'select_account' } },
      })
      if (error) throw error
    } catch {
      setMensaje('No se pudo iniciar el acceso con Google. Reintentá o usá tu correo.')
    } finally { setCargando(false) }
  }

  const enviarFormulario = async (
   e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault()
    if (modo === 'registro' && (!puedeRegistrarse || !terminos || !privacidad)) return
    setMensaje('')
    setCargando(true)

    try {
      if (modo === 'registro') {
        const { data: ready, error: readinessError } = await supabase.rpc(edad === 'teen' ? 'privacy_teen_registration_ready' : 'privacy_registration_ready')
        if (readinessError || ready !== true) throw new Error('No se pudo verificar el acceso. La configuración del servidor puede estar pendiente.')
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { age_band: edad, policy_version: POLICY_VERSION, terms_accepted: true, privacy_acknowledged: true },
            emailRedirectTo: window.location.origin
          }
        })

        if (error) throw error

        setMensaje(
          '💜 Revisá tu correo para confirmar tu cuenta.'
        )
      }

      if (modo === 'login') {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password
          })

        if (error) throw error

        setMensaje('¡Sesión iniciada correctamente! 💜')
      }

      if (modo === 'recuperar') {
        const { error } =
          await supabase.auth.resetPasswordForEmail(
            email.trim(),
            {
              redirectTo: window.location.origin
            }
          )

        if (error) throw error

        setMensaje(
          'Si el correo está registrado, recibirás instrucciones.'
        )
      }
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? error.message
          : 'Ocurrió un error. Intentá nuevamente.'
      )
    } finally {
      setCargando(false)
    }
  }


  const cambiarModo = (nuevoModo: Modo) => {
    setModo(nuevoModo)
    setMensaje('')
    setPassword('')
    setEdad(''); setTerminos(false); setPrivacidad(false)
  }

  return (
    <section className="auth-container">
      <div className="auth-travel-art"><TravelIllustration kind="flight" /></div>
      <h1>💜 ARMY Travel</h1>
      <p>{t("Tu próxima aventura comienza aquí")}</p>
      {onGuest && <button type="button" className="auth-guest-card" aria-label={t('Entrar como visitante')} onClick={onGuest}><span className="auth-guest-art"><TravelIllustration kind="trip" /></span><span><strong>{t('Entrar como visitante')}</strong><small>{t('Usar el planificador sin cuenta')}</small></span><span aria-hidden="true">↗</span></button>}

      <h2>
        {modo === 'login'
          ? t("Iniciar sesión")
          : modo === 'registro'
          ? t("Crear cuenta")
          : t("Recuperar contraseña")}
      </h2>

      <form onSubmit={enviarFormulario}>
        {modo === 'registro' && <><AgeChoice value={edad} onChange={value => { setEdad(value); setTerminos(false); setPrivacidad(false); if (!['adult','teen'].includes(value)) { setEmail(''); setPassword('') } }} />{edad === 'under14' && <AgeNotice onGuest={onGuest} />}{edad === 'teen' && <TeenNotice />}</>}
        {(modo !== 'registro' || puedeRegistrarse) && <>
        <label htmlFor="auth-email">{t("Correo electrónico")}</label>

        <input
          id="auth-email"
          type="email"
          placeholder="tuemail@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        {modo !== 'recuperar' && (
          <>
            <label htmlFor="auth-password">{t("Contraseña")}</label>

            <input
              id="auth-password"
              type="password"
              placeholder={t('Mínimo 6 caracteres')}
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              minLength={6}
              autoComplete={
                modo === 'registro'
                  ? 'new-password'
                  : 'current-password'
              }
              required
            />
          </>
        )}

        <>{modo === 'registro' && <PolicyChoices terms={terminos} privacy={privacidad} onTerms={setTerminos} onPrivacy={setPrivacidad} />}</>
        <button className="auth-submit" type="submit" disabled={cargando || (modo === 'registro' && (!terminos || !privacidad || !puedeRegistrarse))}>
          {cargando
            ? t("Procesando...")
            : modo === 'login'
            ? t("Iniciar sesión")
            : modo === 'registro'
            ? t("Registrarme")
            : t("Enviar instrucciones")}<span aria-hidden="true"> →</span>
        </button>
        </>}
      </form>
      {modo === 'login' && <div className="auth-google">
        <button type="button" disabled={cargando} onClick={() => void ingresarConGoogle()}>{t('Ingresar con Google')}</button>
        <p>{t('Para cuentas existentes. Si todavía no tenés cuenta, registrate con tu correo y completá edad y consentimientos.')}</p>
      </div>}



      {mensaje && (
        <p className="auth-message" role="status">
          {t(mensaje)}
        </p>
      )}

      <div className="auth-links">
        {modo === 'login' && (
          <>
            <button
              type="button"
              onClick={() => cambiarModo('registro')}
            >{t("¿No tenés cuenta? Registrate")}</button>

            <button
              type="button"
              onClick={() => cambiarModo('recuperar')}
            >{t("Olvidé mi contraseña")}</button>
          </>
        )}

        {modo !== 'login' && (
          <button
            type="button"
            onClick={() => cambiarModo('login')}
          >{t("Volver a iniciar sesión")}</button>
        )}
      </div>
    </section>
  )
}
