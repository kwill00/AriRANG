# ARMY Travel · AriRANG

Aplicación existente de planificación de viajes y comunidad. React, TypeScript,
Vite y Supabase. Este repositorio conserva los avances de interfaz, privacidad,
acceso adolescente y pruebas de Mercado Pago.

- Instalar dependencias: `npm ci`.
- Verificar: `npm test`, `npm run test:e2e`, `npm run lint`, `npm run check:payments`, `npm run build`.
- [Configurar el entorno aislado de Mercado Pago](docs/MERCADOPAGO-SANDBOX.md).
- [Proyecto de pruebas creado y pasos para empezar](docs/ENTORNO-PRUEBAS-SERVIDOR.md).
- [Estado del servidor y configuración de acceso](docs/CONFIGURAR-ACCESO-SERVIDOR.md).

Los cobros reales no están habilitados. El checkout nuevo necesita el proyecto
Supabase de pruebas; no debe desplegarse en producción. Las credenciales privadas
permanecen en secretos del servidor y los archivos de entorno se excluyen de Git.
Subir esta rama no publica la aplicación ni configura despliegues automáticos.

## Notas originales de la plantilla: React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
