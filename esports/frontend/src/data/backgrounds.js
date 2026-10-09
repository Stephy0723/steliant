// Fondos de perfil
// gradient: fondos generados con CSS; image: recurso visual real
export const PROFILE_BACKGROUNDS = [
  // Pack visual de bienvenida
  { id: 'banner-basic-1', name: 'Welcome Drop I', unlocked: true, unlock: null, image: '/demos/steliant-esports/banner/Basic1.jpg', accent: '#7c3aed', collection: 'Starter Pack' },
  { id: 'banner-basic-2', name: 'Welcome Drop II', unlocked: true, unlock: null, image: '/demos/steliant-esports/banner/Basic2.jpg', accent: '#06b6d4', collection: 'Starter Pack' },
  { id: 'banner-basic-3', name: 'Welcome Drop III', unlocked: true, unlock: null, image: '/demos/steliant-esports/banner/Basic2.jpg', poster: '/demos/steliant-esports/banner/Basic2.jpg', accent: '#f97316', collection: 'Starter Pack', isVideo: false },
  { id: 'banner-basic-4', name: 'Welcome Drop IV', unlocked: true, unlock: null, image: '/demos/steliant-esports/banner/Basic4.jpg', accent: '#ec4899', collection: 'Starter Pack' },
  { id: 'banner-basic-5', name: 'Welcome Drop V', unlocked: true, unlock: null, image: '/demos/steliant-esports/banner/Basic5.jpg', accent: '#22c55e', collection: 'Starter Pack' },

  // Desbloqueados por defecto
  { id: 'bg1', name: 'Fondo 1', unlocked: true, unlock: null, gradient: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)' },
  { id: 'bg2', name: 'Fondo 2', unlocked: true, unlock: null, gradient: 'linear-gradient(135deg,#2d1b69,#11998e,#38ef7d)' },
  { id: 'bg12', name: 'Fondo 12', unlocked: true, unlock: null, gradient: 'linear-gradient(135deg,#f093fb,#f5576c,#4facfe)' },
  { id: 'bg15', name: 'Fondo 15', unlocked: true, unlock: null, gradient: 'linear-gradient(135deg,#667eea,#764ba2,#f093fb)' },

  // Con condicion
  { id: 'bg3', name: 'Fondo 3', unlocked: false, unlock: 'Gana 3 torneos', condition: { torneos: 3 }, premiumPlan: true, progress: '0/3', gradient: 'linear-gradient(135deg,#fc4a1a,#f7b733)' },
  { id: 'bg4', name: 'Fondo 4', unlocked: false, unlock: '100 referidos', condition: { referidos: 100 }, progress: '0/100', gradient: 'linear-gradient(135deg,#141e30,#243b55)' },
  { id: 'bg5', name: 'Fondo 5', unlocked: false, unlock: '26 logros', condition: { logros: 26 }, progress: '5/26', gradient: 'linear-gradient(135deg,#373b44,#4286f4)' },
  { id: 'bg6', name: 'Fondo 6', unlocked: false, unlock: '100 referidos', condition: { referidos: 100 }, progress: '0/100', gradient: 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)' },
  { id: 'bg7', name: 'Fondo 7', unlocked: false, unlock: 'Gana 12 torneos', condition: { torneos: 12 }, progress: '0/12', gradient: 'linear-gradient(135deg,#11998e,#38ef7d)' },
  { id: 'bg8', name: 'Fondo 8', unlocked: false, unlock: '26 logros', condition: { logros: 26 }, progress: '5/26', gradient: 'linear-gradient(135deg,#e53935,#e35d5b)' },
  { id: 'bg9', name: 'Fondo 9', unlocked: false, unlock: '100 referidos', condition: { referidos: 100 }, progress: '0/100', gradient: 'linear-gradient(135deg,#f46b45,#eea849)' },
  { id: 'bg10', name: 'Fondo 10', unlocked: false, unlock: 'Gana 1 torneo', condition: { torneos: 1 }, progress: '0/1', gradient: 'linear-gradient(135deg,#1d2671,#c33764)' },
  { id: 'bg11', name: 'Fondo 11', unlocked: false, unlock: '8 referidos', condition: { referidos: 8 }, progress: '0/8', gradient: 'linear-gradient(135deg,#16222a,#3a6186)' },
  { id: 'bg13', name: 'Fondo 13', unlocked: false, unlock: 'Gana 2 torneos', condition: { torneos: 2 }, premiumPlan: true, progress: '0/2', gradient: 'linear-gradient(135deg,#cc2b5e,#753a88)' },
  { id: 'bg14', name: 'Fondo 14', unlocked: false, unlock: '12 referidos', condition: { referidos: 12 }, progress: '0/12', gradient: 'linear-gradient(135deg,#4ca1af,#2c3e50)' },
  { id: 'bg16', name: 'Fondo 16', unlocked: false, unlock: 'Gana 2 torneos', condition: { torneos: 2 }, progress: '0/2', gradient: 'linear-gradient(135deg,#f7971e,#ffd200)' },
  { id: 'bg17', name: 'Fondo 17', unlocked: false, unlock: '7 logros', condition: { logros: 7 }, progress: '5/7', gradient: 'linear-gradient(135deg,#36d1dc,#5b86e5)' },
  { id: 'bg18', name: 'Fondo 18', unlocked: false, unlock: '20 referidos', condition: { referidos: 20 }, progress: '0/20', gradient: 'linear-gradient(135deg,#e96c6c,#c33764,#1d2671)' },
  { id: 'bg19', name: 'Fondo 19', unlocked: false, unlock: 'Gana 3 torneos', condition: { torneos: 3 }, progress: '0/3', gradient: 'linear-gradient(135deg,#a18cd1,#fbc2eb)' },
  { id: 'bg20', name: 'Fondo 20', unlocked: false, unlock: '5 referidos', condition: { referidos: 5 }, progress: '0/5', gradient: 'linear-gradient(135deg,#fddb92,#d1fdff)' },

  // Custom upload
  { id: 'custom', name: 'Personalizado', unlocked: true, unlock: null, gradient: null, isCustom: true },
]

