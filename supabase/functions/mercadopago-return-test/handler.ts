export function testReturn(request: Request) {
 if (request.method !== 'GET') return new Response(null, { status: 405 })
 return new Response('Volviste de Mercado Pago\n\nEsta página no confirma ningún pago. No interpreta los parámetros de la dirección.\n\nVolvé a la pestaña local de ARMY Travel y elegí Actualizar estado guardado. Si cerraste la pestaña, elegí Recuperar mis pruebas.\n\nSi falta la notificación, consultá el identificador de pago en la cuenta de prueba y verificalo desde la aplicación.', {
   headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'", 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' },
 })
}
