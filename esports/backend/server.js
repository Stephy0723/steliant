import 'dotenv/config'
import { createServer } from 'node:http'
import { config } from './src/config/index.js'
import { connectDatabase, disconnectDatabase } from './src/database/mongo.js'
import { seedCountries } from './src/services/countries.service.js'
import { migrateTeamDiscordToRegistrations } from './src/scripts/migrate-team-discord-to-registrations.js'
import { createApp } from './src/app.js'
import { initializeMessagesRealtime } from './src/realtime/messagesRealtime.js'
import { startScheduledPublishJob, stopScheduledPublishJob } from './src/services/scheduledPublish.service.js'
import { startCheckinCloseJob, stopCheckinCloseJob } from './src/services/checkinClose.service.js'
import { startMatchRemindersJob, stopMatchRemindersJob } from './src/services/matchReminders.service.js'
import { startMatchStatsRecoveryJob, stopMatchStatsRecoveryJob } from './src/services/matchStatsRecovery.service.js'
import { startReportDeadlineJob, stopReportDeadlineJob } from './src/services/reportDeadline.service.js'
import { startMatchResultsJob, stopMatchResultsJob } from './src/services/matchResults.service.js'
import { startRecordingRetentionJob, stopRecordingRetentionJob } from './src/services/matchRecordings.service.js'

async function startServer() {
  try {
    await connectDatabase()
    if (config.mongoEnabled) {
      await seedCountries()
      // Idempotente -- copia Team.discordProvision legacy (pre 2026-09-22) a
      // la inscripcion correcta la primera vez que corre; en arranques
      // siguientes no encuentra nada que migrar. Sin esto, un equipo viejo
      // sin migrar termina con sala de Discord DUPLICADA en su proximo
      // reintento (ver registration.discordProvision vs Team.discordProvision).
      await migrateTeamDiscordToRegistrations().catch((error) => {
        console.error('[startup] migrate-team-discord-to-registrations fallo:', error.message)
      })
      startScheduledPublishJob()
      startCheckinCloseJob()
      startMatchRemindersJob()
      startMatchStatsRecoveryJob()
      startReportDeadlineJob()
      startMatchResultsJob()
      startRecordingRetentionJob()
    }

    const app = createApp()
    const server = createServer(app)
    initializeMessagesRealtime(server)
    server.listen(config.port, () => {
      console.log(`[GlitchGang API] http://localhost:${config.port} — ${config.env}`)
    })

    const shutdown = async (signal) => {
      console.log(`\n${signal} — shutting down...`)
      server.close(async () => {
        stopScheduledPublishJob()
        stopCheckinCloseJob()
        stopMatchRemindersJob()
        await stopMatchStatsRecoveryJob()
        await stopReportDeadlineJob()
        await stopMatchResultsJob()
        await stopRecordingRetentionJob()
        await disconnectDatabase()
        process.exit(0)
      })
    }

    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGTERM', () => shutdown('SIGTERM'))
  } catch (err) {
    console.error('[startup error]', err.message)
    process.exit(1)
  }
}

startServer()
