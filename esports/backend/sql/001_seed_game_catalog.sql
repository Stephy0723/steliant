-- PostgreSQL 14+. Idempotent catalog seed: 5 categories, 25 games.
BEGIN;

CREATE TABLE IF NOT EXISTS game_categories (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        VARCHAR(64) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL UNIQUE,
  sort_order  SMALLINT NOT NULL CHECK (sort_order > 0),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS games (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id    BIGINT NOT NULL REFERENCES game_categories(id),
  slug           VARCHAR(100) NOT NULL UNIQUE,
  name           VARCHAR(140) NOT NULL UNIQUE,
  logo_path      VARCHAR(255) NOT NULL,
  official_logo  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order     SMALLINT NOT NULL CHECK (sort_order BETWEEN 1 AND 5),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, sort_order)
);

INSERT INTO game_categories (slug, name, sort_order) VALUES
  ('moba', 'MOBA', 1),
  ('shooters-battle-royale', 'Shooters / Battle Royale', 2),
  ('fighting-games', 'Fighting Games', 3),
  ('strategy-cards', 'Estrategia y Cartas', 4),
  ('sports-racing', 'Deportes y Carreras', 5)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, is_active = TRUE, updated_at = NOW();

WITH seed(category_slug, slug, name, logo_path, official_logo, sort_order) AS (VALUES
  ('moba', 'honor-of-kings', 'Honor of Kings', '/assets/games/honor-of-kings.svg', TRUE, 1),
  ('moba', 'mobile-legends-bang-bang', 'Mobile Legends: Bang Bang', '/assets/games/mobile-legends-bang-bang.svg', TRUE, 2),
  ('moba', 'league-of-legends-wild-rift', 'League of Legends: Wild Rift', '/assets/games/league-of-legends-wild-rift.svg', TRUE, 3),
  ('moba', 'arena-of-valor', 'Arena of Valor', '/assets/games/arena-of-valor.svg', TRUE, 4),
  ('moba', 'pokemon-unite', 'Pokémon Unite', '/assets/games/pokemon-unite.svg', TRUE, 5),

  ('shooters-battle-royale', 'valorant', 'Valorant', '/assets/games/valorant.svg', TRUE, 1),
  ('shooters-battle-royale', 'call-of-duty-warzone-mobile', 'Call of Duty: Warzone Mobile', '/assets/games/call-of-duty-warzone-mobile.svg', TRUE, 2),
  ('shooters-battle-royale', 'free-fire', 'Free Fire', '/assets/games/free-fire.svg', TRUE, 3),
  ('shooters-battle-royale', 'pubg-mobile', 'PUBG Mobile', '/assets/games/pubg-mobile.svg', TRUE, 4),
  ('shooters-battle-royale', 'farlight-84', 'Farlight 84', '/assets/games/farlight-84.svg', TRUE, 5),

  ('fighting-games', 'street-fighter-6', 'Street Fighter 6', '/assets/games/street-fighter-6.svg', TRUE, 1),
  ('fighting-games', 'tekken-8', 'Tekken 8', '/assets/games/tekken-8.svg', TRUE, 2),
  ('fighting-games', 'mortal-kombat-1', 'Mortal Kombat 1', '/assets/games/mortal-kombat-1.svg', TRUE, 3),
  ('fighting-games', 'guilty-gear-strive', 'Guilty Gear Strive', '/assets/games/guilty-gear-strive.svg', TRUE, 4),
  ('fighting-games', 'brawlhalla-comunitario', 'Brawlhalla Comunitario', '/logos/internal/brawlhalla-comunitario.svg', FALSE, 5),

  ('strategy-cards', 'teamfight-tactics', 'Teamfight Tactics (TFT)', '/assets/games/teamfight-tactics.svg', TRUE, 1),
  ('strategy-cards', 'marvel-snap', 'Marvel Snap', '/assets/games/marvel-snap.svg', TRUE, 2),
  ('strategy-cards', 'clash-royale', 'Clash Royale', '/assets/games/clash-royale.svg', TRUE, 3),
  ('strategy-cards', 'slay-the-spire-competitivo', 'Slay the Spire Competitivo', '/logos/internal/slay-the-spire-competitivo.svg', FALSE, 4),
  ('strategy-cards', 'ajedrez-online', 'Ajedrez Online', '/logos/internal/ajedrez-online.svg', FALSE, 5),

  ('sports-racing', 'ea-sports-fc-mobile', 'EA Sports FC Mobile', '/assets/games/ea-sports-fc-mobile.svg', TRUE, 1),
  ('sports-racing', 'rocket-league-sideswipe', 'Rocket League Sideswipe', '/assets/games/rocket-league-sideswipe.svg', TRUE, 2),
  ('sports-racing', 'efootball-mobile', 'eFootball Mobile', '/assets/games/efootball-mobile.svg', TRUE, 3),
  ('sports-racing', 'trackmania-open-series', 'TrackMania Open Series', '/logos/internal/trackmania-open-series.svg', FALSE, 4),
  ('sports-racing', 'simracing-ligas', 'SimRacing Ligas', '/logos/internal/simracing-ligas.svg', FALSE, 5)
)
INSERT INTO games (category_id, slug, name, logo_path, official_logo, sort_order)
SELECT category.id, seed.slug, seed.name, seed.logo_path, seed.official_logo, seed.sort_order
FROM seed
JOIN game_categories category ON category.slug = seed.category_slug
ON CONFLICT (slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  logo_path = EXCLUDED.logo_path,
  official_logo = EXCLUDED.official_logo,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_games_category_active ON games(category_id, is_active, sort_order);

COMMIT;
