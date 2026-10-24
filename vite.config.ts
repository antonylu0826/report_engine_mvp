import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { defineConfig } from 'vite';
import { reportLayoutPlugin } from './src/server/layoutPlugin.ts';

export default defineConfig({
  plugins: [react(), tailwindcss(), reportLayoutPlugin(process.env.REPORT_ENGINE_LAYOUT_FILE || path.resolve(import.meta.dirname, 'current_report_layout.json'))],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: { watch: { ignored: ['**/scratch/**', '**/tmp/**', '**/output/**'] } },
  build: {
    manifest: true,
    rolldownOptions: {
      preserveEntrySignatures: false,
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          // Keep shared dependencies out of PDF groups so the designer stays lazy.
          includeDependenciesRecursively: false,
          groups: [
            { name: 'react', test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/, priority: 40, entriesAware: true },
            { name: 'pdf-fonts', test: /node_modules[\\/](?:fontkit|@react-pdf[\\/]font)[\\/]/, priority: 30, entriesAware: true },
            { name: 'pdf-core', test: /node_modules[\\/]pdfkit[\\/]/, priority: 20, entriesAware: true },
            { name: 'pdf-layout', test: /node_modules[\\/](?:yoga-layout|@react-pdf[\\/]layout)[\\/]/, priority: 10, entriesAware: true },
            { name: 'pdf-runtime', test: /node_modules[\\/]@react-pdf[\\/]/, priority: 5, entriesAware: true, maxSize: 700_000 },
          ],
        },
      },
    },
  },
});
