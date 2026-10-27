import { useT } from '../lib/locale'
import { useId, useState } from 'react'
import PerfilSocial from './PerfilSocial'

export default function AutorSocial({ autorId, usuarioId, nombre }: { autorId: string; usuarioId: string; nombre?: string }) {
  const t = useT()
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  const etiqueta = nombre || (autorId === usuarioId ? t('Vos') : t('Miembro ARMY'))
  return <div className="autor-social">
    <button type="button" className="autor-social-boton" aria-label={t('Ver perfil de {nombre}', { nombre: etiqueta })} aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto(v => !v)}>
      <span className="autor-social-avatar" aria-hidden="true">{etiqueta.slice(0, 1).toLocaleUpperCase('es')}</span>
      <span>{etiqueta}{nombre && autorId === usuarioId ? ` · ${t('Vos')}` : ''}</span>
    </button>
    {abierto && <div id={id}><PerfilSocial autorId={autorId} usuarioId={usuarioId} /><button type="button" onClick={() => setAbierto(false)}>{t("Cerrar perfil")}</button></div>}
  </div>
}
