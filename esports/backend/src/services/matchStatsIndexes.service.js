import { MatchStatsDraft } from '../models/MatchStatsDraft.js'
import { PlayerMatch } from '../models/PlayerMatch.js'

// Additive only: never syncIndexes(), drop collections, or rewrite legacy stats.
export async function ensureMatchStatsIndexes() {
  await MatchStatsDraft.collection.createIndex({ tournament: 1, bracketMatchId: 1, gameNumber: 1 }, { unique: true })
  await MatchStatsDraft.collection.createIndex({ status: 1, historyWrittenAt: 1, historyRetryAt: 1 })
  await PlayerMatch.collection.createIndex({ statsDraft: 1, player: 1 }, { unique: true, partialFilterExpression: { statsDraft: { $type: 'objectId' } } })
}
