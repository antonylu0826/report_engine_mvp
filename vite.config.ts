import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'
import { defineConfig, type Plugin } from 'vite'

function mcpSyncPlugin(): Plugin {
  return {
    name: 'mcp-sync-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const layoutPath = path.resolve(import.meta.dirname, 'current_report_layout.json')

        if (req.url === '/api/report-layout') {
          if (req.method === 'GET') {
            if (fs.existsSync(layoutPath)) {
              try {
                const stat = fs.statSync(layoutPath)
                const content = fs.readFileSync(layoutPath, 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.end(
                  JSON.stringify({
                    mtime: stat.mtimeMs,
                    report: JSON.parse(content),
                  })
                )
                return
              } catch (e) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: (e as Error).message }))
                return
              }
            } else {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'current_report_layout.json not found' }))
              return
            }
          } else if (req.method === 'POST') {
            let body = ''
            req.on('data', (chunk) => {
              body += chunk
            })
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body)
                fs.writeFileSync(layoutPath, JSON.stringify(parsed, null, 2), 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true }))
              } catch (e) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: (e as Error).message }))
              }
            })
            return
          }
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    mcpSyncPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
