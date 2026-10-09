import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from './database/mongo.js'
import { createPlayerCodes, createTournamentCode, createTeamCode } from './services/codes.service.js'

async function runTest() {
  try {
    await connectDatabase()
    
    console.log('--- Probando generación de códigos ---')
    
    // 1. Jugador
    const playerResult = await createPlayerCodes('RD', 'Stephanie', '2003-10-07', 'Lopez Frias')
    console.log('Jugador (Stephanie Lopez Frias, Nacimiento: 2003-10-07, RD):')
    console.log('  Público: ', playerResult.publicCode)
    console.log('  Interno: ', playerResult.internalCode)
    
    // 2. Torneo
    const tournamentResult = await createTournamentCode('RD', 'FF')
    console.log('\nTorneo (Free Fire, RD):')
    console.log('  Público: ', tournamentResult.publicCode)
    console.log('  Interno: ', tournamentResult.internalCode)
    
    // 3. Equipo
    const teamResult = await createTeamCode('RD')
    console.log('\nEquipo (RD):')
    console.log('  Público: ', teamResult.publicCode)
    console.log('  Interno: ', teamResult.internalCode)
    
    console.log('--------------------------------------')
    
    await disconnectDatabase()
    process.exit(0)
  } catch (error) {
    console.error('Error durante la prueba:', error)
    process.exit(1)
  }
}

runTest()
