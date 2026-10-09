// Ciudades/zonas principales por pais -- cubre los mismos paises curados que
// DIAL_CODES (el core de usuarios de la plataforma: RD + LatAm + US/CA + ES).
// Cualquier otro pais del selector se queda con el campo de texto libre que
// ya existia, no hay lista inventada para el resto del mundo.
export const CITIES_BY_COUNTRY = {
  RD: [
    'Santo Domingo', 'Santiago de los Caballeros', 'San Cristobal', 'La Vega',
    'San Pedro de Macoris', 'La Romana', 'Puerto Plata', 'San Francisco de Macoris',
    'Higuey', 'Moca', 'Bonao', 'Bani', 'Nagua', 'Barahona', 'Azua', 'Mao',
    'Cotui', 'Monte Plata', 'San Juan de la Maguana', 'Hato Mayor', 'El Seibo',
    'Samana', 'Dajabon', 'Neiba', 'Comendador', 'Pedernales', 'Montecristi',
    'San Jose de Ocoa', 'Salcedo', 'San Ignacio de Sabaneta', 'Jimani', 'Boca Chica',
  ],
  US: ['Nueva York', 'Los Angeles', 'Miami', 'Orlando', 'Chicago', 'Houston', 'Boston', 'San Francisco', 'Atlanta', 'Washington D.C.'],
  CA: ['Toronto', 'Montreal', 'Vancouver', 'Ottawa', 'Calgary'],
  MX: ['Ciudad de Mexico', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'Cancun', 'Merida'],
  AR: ['Buenos Aires', 'Cordoba', 'Rosario', 'Mendoza', 'La Plata'],
  CO: ['Bogota', 'Medellin', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga'],
  VE: ['Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Maracay'],
  CL: ['Santiago', 'Valparaiso', 'Concepcion', 'Antofagasta'],
  PE: ['Lima', 'Arequipa', 'Trujillo', 'Cusco'],
  EC: ['Quito', 'Guayaquil', 'Cuenca'],
  BO: ['La Paz', 'Santa Cruz', 'Cochabamba'],
  PY: ['Asuncion', 'Ciudad del Este'],
  UY: ['Montevideo', 'Punta del Este'],
  BR: ['Sao Paulo', 'Rio de Janeiro', 'Brasilia', 'Salvador', 'Belo Horizonte'],
  PA: ['Ciudad de Panama', 'Colon', 'David'],
  CR: ['San Jose', 'Alajuela', 'Cartago'],
  SV: ['San Salvador', 'Santa Ana'],
  GT: ['Ciudad de Guatemala', 'Quetzaltenango'],
  HN: ['Tegucigalpa', 'San Pedro Sula'],
  NI: ['Managua', 'Leon'],
  CU: ['La Habana', 'Santiago de Cuba', 'Varadero'],
  PR: ['San Juan', 'Bayamon', 'Ponce', 'Caguas'],
  ES: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Malaga'],
}

export function citiesFor(countryCode) {
  return CITIES_BY_COUNTRY[String(countryCode || '').toUpperCase()] || null
}

