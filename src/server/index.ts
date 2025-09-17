import { createApp } from './createApp'

const port = Number(process.env.PORT ?? 4000)

async function start() {
  const app = await createApp()
  try {
    await app.listen({ port, host: '0.0.0.0' })
    console.log(`Server listening on http://localhost:${port}`)
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

void start()
