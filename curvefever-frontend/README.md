# Curvefever Frontend

## Local HTTPS for iPhone testing

1. Install `mkcert` once.
2. Start backend on `3001`.
3. Start Vite on LAN (`0.0.0.0`).

```bash
brew install mkcert
mkcert -install

cd backend
npm install
npm run dev

cd ../curvefever-frontend
npm install
npm run dev
```

The Vite config will auto-generate and refresh `../certs/dev-key.pem` and
`../certs/dev-cert.pem` with `mkcert`, including all current local IPv4 LAN
addresses on your Mac. If your LAN IP changes, the next `npm run dev` will
refresh the cert automatically.

Open on your iPhone using:

- `https://<your-mac-lan-ip>:5173`

Important: `mkcert -install` must have been run on the Mac that is serving the
site. If `mkcert` is missing, Vite falls back to any existing cert files.

If you need a custom cert location:

```bash
VITE_SSL_KEY=/absolute/path/to/key.pem VITE_SSL_CERT=/absolute/path/to/cert.pem npm run dev
```

If you need to bypass proxying and connect directly to backend:

```bash
VITE_BACKEND_URL=http://<your-mac-lan-ip>:3001 npm run dev
```

By default, the socket client uses same-origin `/socket.io`, and Vite proxies it to `http://127.0.0.1:3001`.

## React + TypeScript + Vite Template Notes

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

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

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

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
