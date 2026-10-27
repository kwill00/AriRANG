# Checkout de prueba y publicación del 27 de octubre de 2026

Se desplegó mercadopago-checkout-test en Supabase buhgdsnxmmoqshvoyyth con Verify JWT activado. Usa MERCADOPAGO_ACCESS_TOKEN_TEST; no usa ni expone la clave de diagnóstico o service_role.

El servidor comprueba la sesión con Supabase Auth, es_admin y privacy_access_allowed. Solo admite administradores adultos con consentimiento vigente y una cuenta vendedora argentina marcada test_user por Mercado Pago. No acepta importes, monedas ni destinatarios del navegador.

El panel Administración incorpora Checkout de prueba: ARS100 ficticios, Checkout Pro Preferences API, init_point del vendedor de prueba y retorno a la web. La orden queda firmada y ligada al usuario por una hora; la verificación consulta /v1/payments y comprueba live_mode=false, referencia, importe, moneda y receptor. Una URL de retorno no acredita un pago. No actualiza donaciones ni suscripciones.

No hay split ejecutado: la interfaz lo indica. La política 75% organizadora/25% plataforma, con costos del proveedor a cargo de plataforma, sigue pendiente de implementar mediante OAuth y una asignación de comisiones verificada. No hay webhooks de pagos ni automatización de liquidaciones. No se habilitaron cobros reales.

Validación: compilación correcta, 58 pruebas automatizadas del servidor/lógica y 2 pruebas de navegador con red externa simulada aprobadas. La prueba del endpoint desplegado sin sesión devolvió SIGN_IN_REQUIRED. No se creó ni pagó una preferencia contra Mercado Pago durante esta publicación: falta la prueba integral con sesión administradora real y comprador de prueba.

La web se publicó mediante Netlify Drop en quiet-kelpie-28a2b2, https://armytravellatam.com. Netlify confirmó Currently published y se verificó en la página el archivo /assets/index-BWgiDbl9.js de esta compilación. Se conservaron las cabeceras de seguridad y avisos de runtime; se distribuyeron solo los recursos públicos revisados por la configuración Vite del proyecto.

Para probar: iniciar sesión en la web como administrador adulto, entrar en Administración, preparar el checkout ARS100 y continuar solo con una cuenta compradora de prueba argentina. Al regresar, pulsar Verificar resultado con Mercado Pago. Nunca usar cuentas ni tarjetas reales.
