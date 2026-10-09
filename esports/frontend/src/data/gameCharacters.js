// Roster real de personajes/agentes/heroes por juego, para los juegos donde
// el elenco es publico, conocido y de tamano manejable (shooters con
// personajes y juegos de pelea). Un juego que no esta aca no tiene un
// "main" en el sentido tradicional (MOBAs con 100+ campeones, shooters sin
// personajes, etc.) -- el formulario cae a texto libre en vez de inventar o
// truncar un roster que no podemos garantizar completo. Mismo patron que
// GAME_MODALITIES en shared/games.mjs y GAME_RANK_TIERS en gameRanks.js.
export const GAME_CHARACTERS = {
  valorant: [
    'Brimstone', 'Viper', 'Omen', 'Killjoy', 'Cypher', 'Sova', 'Sage', 'Phoenix', 'Jett', 'Reyna',
    'Raze', 'Breach', 'Skye', 'Yoru', 'Astra', 'KAY/O', 'Chamber', 'Neon', 'Fade', 'Harbor',
    'Gekko', 'Deadlock', 'Iso', 'Clove', 'Vyse', 'Tejo', 'Waylay',
  ],
  overwatch: [
    'D.Va', 'Doomfist', 'Junker Queen', 'Mauga', 'Orisa', 'Ramattra', 'Reinhardt', 'Roadhog', 'Sigma', 'Winston',
    'Wrecking Ball', 'Zarya', 'Hazard', 'Ashe', 'Bastion', 'Cassidy', 'Echo', 'Genji', 'Hanzo', 'Junkrat',
    'Mei', 'Pharah', 'Reaper', 'Sojourn', 'Soldier: 76', 'Sombra', 'Symmetra', 'Torbjörn', 'Tracer', 'Widowmaker',
    'Venture', 'Freja', 'Ana', 'Baptiste', 'Brigitte', 'Illari', 'Kiriko', 'Lifeweaver', 'Lúcio', 'Mercy',
    'Moira', 'Zenyatta', 'Juno',
  ],
  'overwatch-2': [
    'D.Va', 'Doomfist', 'Junker Queen', 'Mauga', 'Orisa', 'Ramattra', 'Reinhardt', 'Roadhog', 'Sigma', 'Winston',
    'Wrecking Ball', 'Zarya', 'Hazard', 'Ashe', 'Bastion', 'Cassidy', 'Echo', 'Genji', 'Hanzo', 'Junkrat',
    'Mei', 'Pharah', 'Reaper', 'Sojourn', 'Soldier: 76', 'Sombra', 'Symmetra', 'Torbjörn', 'Tracer', 'Widowmaker',
    'Venture', 'Freja', 'Ana', 'Baptiste', 'Brigitte', 'Illari', 'Kiriko', 'Lifeweaver', 'Lúcio', 'Mercy',
    'Moira', 'Zenyatta', 'Juno',
  ],
  'apex-legends': [
    'Bangalore', 'Bloodhound', 'Caustic', 'Crypto', 'Gibraltar', 'Horizon', 'Lifeline', 'Loba', 'Mirage', 'Octane',
    'Pathfinder', 'Rampart', 'Revenant', 'Valkyrie', 'Wattson', 'Wraith', 'Ash', 'Mad Maggie', 'Newcastle', 'Seer',
    'Vantage', 'Catalyst', 'Ballistic', 'Conduit', 'Alter', 'Sparrow',
  ],
  'street-fighter-6': [
    'Ryu', 'Luke', 'Jamie', 'Guile', 'Ken', 'Chun-Li', 'Kimberly', 'Marisa', 'Manon', 'JP',
    'Zangief', 'Dee Jay', 'Cammy', 'Lily', 'Rashid', 'Blanka', 'Juri', 'Dhalsim', 'E. Honda', 'Akuma',
    'M. Bison', 'Terry', 'Mai', 'A.K.I.', 'Ed', 'Elena',
  ],
  'tekken-8': [
    'Jin Kazama', 'Kazuya Mishima', 'Jun Kazama', 'Nina Williams', 'King', 'Paul Phoenix', 'Law', 'Xiaoyu', 'Hwoarang', 'Bryan Fury',
    'Claudio', 'Lars', 'Lili', 'Asuka', 'Lei', 'Zafina', 'Devil Jin', 'Yoshimitsu', 'Steve Fox', 'Kuma',
    'Panda', 'Feng', 'Leroy', 'Alisa', 'Dragunov', 'Azucena', 'Victor', 'Reina', 'Raven', 'Jack-8',
    'Shaheen', 'Eddy Gordo', 'Clive', 'Heihachi', 'Fahkumram', 'Anna Williams',
  ],
  'mortal-kombat-1': [
    'Liu Kang', 'Kung Lao', 'Johnny Cage', 'Kitana', 'Mileena', 'Sindel', 'Shang Tsung', 'Raiden', 'Scorpion', 'Sub-Zero',
    'Smoke', 'Baraka', 'Reptile', 'Ashrah', 'Havik', 'Nitara', 'General Shao', 'Geras', 'Rain', 'Tanya',
    'Reiko', 'Ermac', 'Takeda', 'Noob Saibot', 'Quan Chi',
  ],
  'guilty-gear-strive': [
    'Sol Badguy', 'Ky Kiske', 'May', 'Axl Low', 'Chipp Zanuff', 'Potemkin', 'Faust', 'Millia Rage', 'Zato-1', 'Ramlethal Valentine',
    'Leo Whitefang', 'Nagoriyuki', 'Giovanna', 'Anji Mito', 'I-No', 'Goldlewis Dickinson', "Jack-O'", 'Happy Chaos', 'Baiken', 'Testament',
    'Bridget', 'Sin Kiske', 'Asuka R#', 'Johnny', 'Elphelt Valentine', 'A.B.A', 'Slayer', 'Queen Dizzy',
  ],
}

export function charactersFor(gameId) {
  return GAME_CHARACTERS[String(gameId || '')] || []
}

