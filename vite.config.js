import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": `${import.meta.dirname}/src`,
      "@components": `${import.meta.dirname}/src/componenets`,
      "@hooks": `${import.meta.dirname}/src/hooks`,
      "@lib": `${import.meta.dirname}/src/lib`,
      "@pages": `${import.meta.dirname}/src/pages`,
      "@admin": `${import.meta.dirname}/src/pages/admin`,
      "@app": `${import.meta.dirname}/src/pages/app`,
      "@routes": `${import.meta.dirname}/src/routes`,
      "@utils": `${import.meta.dirname}/src/utils`,
    },
  },
})
