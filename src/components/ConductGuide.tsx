import { useT } from '../lib/locale'
export const CONDUCT_VERSION = '2026-10-26'
const rules = [
  'Tratamos a todas las personas con respeto. No se permiten insultos, amenazas, acoso, discriminación ni humillaciones.',
  'No publiques contenido sexual explícito, violencia gráfica, explotación ni pedidos de imágenes íntimas.',
  'No compartas teléfono, correo, redes, domicilio, escuela, documentos, datos bancarios ni ubicación en tiempo real, propios o ajenos.',
  'No se permiten ventas, pedidos de dinero, enlaces externos, spam ni invitaciones a conversaciones privadas en este espacio.',
  'Usá solo contenido que puedas compartir. No suplantes identidades ni publiques rumores como hechos.',
  'Si algo te incomoda, dejá de interactuar y hablá con una persona adulta de confianza. No respondas a pedidos de secretos o datos privados.',
  'En el espacio limitado, cada propuesta pasa por revisión antes de aparecer. Un filtro de palabras puede ayudar a detectar problemas, pero no garantiza seguridad.',
  'Administración puede rechazar o retirar publicaciones y deja un motivo. No se garantiza un plazo de revisión ni un servicio de emergencia.',
]
export default function ConductGuide() {
  const t = useT()
  return <details className="conduct-guide"><summary>{t('Manual de convivencia')}</summary><p>{t('Estas reglas protegen a una comunidad con niñas, niños, adolescentes y adultos.')}</p><ol>{rules.map(rule => <li key={rule}>{t(rule)}</li>)}</ol><p>{t('Versión de las reglas: {version}', { version: CONDUCT_VERSION })}</p></details>
}
