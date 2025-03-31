// Función auxiliar para normalizar texto eliminando acentos y caracteres especiales
export function normalizeText(text: string): string {
  if (!text) return '';
  
  // Reemplazos específicos para caracteres problemáticos
  let normalized = text;
  
  // Eliminar comillas que pueden estar en los datos como "Madrid, España"
  normalized = normalized.replace(/"/g, '');
  normalized = normalized.replace(/'/g, '');
  
  // Reemplazos específicos para manejo adecuado de caracteres españoles
  const replacements: {[key: string]: string} = {
    'ñ': 'n', 'Ñ': 'n',
    'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'Á': 'a', 'À': 'a', 'Ä': 'a', 'Â': 'a',
    'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e', 'É': 'e', 'È': 'e', 'Ë': 'e', 'Ê': 'e',
    'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i', 'Í': 'i', 'Ì': 'i', 'Ï': 'i', 'Î': 'i',
    'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'Ó': 'o', 'Ò': 'o', 'Ö': 'o', 'Ô': 'o',
    'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u', 'Ú': 'u', 'Ù': 'u', 'Ü': 'u', 'Û': 'u',
    'ç': 'c', 'Ç': 'c'
  };
  
  // Aplicar reemplazos específicos
  for (const [original, replacement] of Object.entries(replacements)) {
    normalized = normalized.replace(new RegExp(original, 'g'), replacement);
  }
  
  // Aplicar normalización Unicode para cualquier otro acento o diacrítico
  normalized = normalized.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .toLowerCase(); // Convertir a minúsculas
  
  // Eliminar caracteres no alfanuméricos excepto espacios y comas (importantes para ubicaciones)
  normalized = normalized.replace(/[^\w\s,]/g, ' ');
  
  // Eliminar espacios múltiples
  normalized = normalized.replace(/\s+/g, ' ').trim();
    
  console.log(`Normalización mejorada: "${text}" → "${normalized}"`);
  return normalized;
}

// Diccionario mejorado de variantes de países y ciudades
export const listaVariantesPaises = {
  espana: ['ESPANA', 'ESPAÑA', 'ESPANHA', 'ESPAGNE', 'SPAIN'],
  italia: ['ITALIA', 'ITALIE', 'ITALY'],
  francia: ['FRANCIA', 'FRANCE'],
  alemania: ['ALEMANIA', 'GERMANY', 'ALLEMAGNE'],
  portugal: ['PORTUGAL'],
  austria: ['AUSTRIA', 'ÖSTERREICH'],
  belgica: ['BELGICA', 'BÉLGICA', 'BELGIUM', 'BELGIQUE'],
  holanda: ['HOLANDA', 'PAISES BAJOS', 'PAÍSES BAJOS', 'NETHERLANDS', 'HOLLAND'],
  suiza: ['SUIZA', 'SWITZERLAND', 'SUISSE'],
  grecia: ['GRECIA', 'GREECE', 'GRÈCE'],
  rumania: ['RUMANIA', 'RUMANÍA', 'ROMANIA', 'RUMANÌA', 'ROUMANIE'],
  bulgaria: ['BULGARIA', 'BULGARIE'],
  hungria: ['HUNGRIA', 'HUNGRÍA', 'HUNGARY', 'HONGRIE'],
  polonia: ['POLONIA', 'POLAND', 'POLOGNE'],
  republica_checa: ['REPUBLICA CHECA', 'REPÚBLICA CHECA', 'CZECH REPUBLIC'],
  eslovaquia: ['ESLOVAQUIA', 'SLOVAKIA', 'SLOVAQUIE'],
  eslovenia: ['ESLOVENIA', 'SLOVENIA', 'SLOVÉNIE'],
  croacia: ['CROACIA', 'CROATIA', 'CROATIE'],
  serbia: ['SERBIA', 'SERBIE'],
  ucrania: ['UCRANIA', 'UKRAINE'],
  rusia: ['RUSIA', 'RUSSIA', 'RUSSIE'],
  noruega: ['NORUEGA', 'NORWAY', 'NORVÈGE'],
  suecia: ['SUECIA', 'SWEDEN', 'SUÈDE'],
  finlandia: ['FINLANDIA', 'FINLAND', 'FINLANDE'],
  dinamarca: ['DINAMARCA', 'DENMARK', 'DANEMARK'],
  islandia: ['ISLANDIA', 'ICELAND', 'ISLANDE'],
  irlanda: ['IRLANDA', 'IRELAND', 'IRLANDE'],
  reino_unido: ['REINO UNIDO', 'UNITED KINGDOM', 'UK', 'GRAN BRETAÑA', 'GRAN BRETANA', 'INGLATERRA', 'ENGLAND'],
  estados_unidos: ['ESTADOS UNIDOS', 'UNITED STATES', 'USA', 'US', 'EEUU', 'EE UU', 'EE.UU.'],
  canada: ['CANADA', 'CANADÁ', 'CANADÀ'],
  mexico: ['MEXICO', 'MÉXICO', 'MEXIQUE'],
  brasil: ['BRASIL', 'BRAZIL', 'BRÉSIL'],
  argentina: ['ARGENTINA'],
  chile: ['CHILE', 'CHILI'],
  colombia: ['COLOMBIA', 'COLOMBIE'],
  peru: ['PERU', 'PERÚ', 'PERÙ', 'PEROU'],
  venezuela: ['VENEZUELA'],
  ecuador: ['ECUADOR', 'ÉQUATEUR'],
  bolivia: ['BOLIVIA', 'BOLIVIE'],
  paraguay: ['PARAGUAY'],
  uruguay: ['URUGUAY'],
  panama: ['PANAMA', 'PANAMÁ'],
  costa_rica: ['COSTA RICA'],
  nicaragua: ['NICARAGUA'],
  honduras: ['HONDURAS'],
  el_salvador: ['EL SALVADOR'],
  guatemala: ['GUATEMALA'],
  republica_dominicana: ['REPUBLICA DOMINICANA', 'REPÚBLICA DOMINICANA', 'DOMINICAN REPUBLIC'],
  cuba: ['CUBA'],
  puerto_rico: ['PUERTO RICO'],
  jamaica: ['JAMAICA', 'JAMAÏQUE'],
  china: ['CHINA', 'CHINE'],
  japon: ['JAPON', 'JAPÓN', 'JAPAN'],
  corea_del_sur: ['COREA DEL SUR', 'SOUTH KOREA', 'CORÉE DU SUD'],
  india: ['INDIA', 'INDE'],
  indonesia: ['INDONESIA', 'INDONÉSIE'],
  filipinas: ['FILIPINAS', 'PHILIPPINES', 'FILIPINES'],
  malasia: ['MALASIA', 'MALAYSIA', 'MALAISIE'],
  singapur: ['SINGAPUR', 'SINGAPORE', 'SINGAPOUR'],
  tailandia: ['TAILANDIA', 'THAILAND', 'THAÏLANDE'],
  vietnam: ['VIETNAM', 'VIÊT NAM'],
  australia: ['AUSTRALIA', 'AUSTRALIE'],
  nueva_zelanda: ['NUEVA ZELANDA', 'NEW ZEALAND', 'NOUVELLE-ZÉLANDE'],
  sudafrica: ['SUDAFRICA', 'SUDÁFRICA', 'SOUTH AFRICA', 'AFRIQUE DU SUD'],
  egipto: ['EGIPTO', 'EGYPT', 'ÉGYPTE'],
  marruecos: ['MARRUECOS', 'MOROCCO', 'MAROC'],
  argelia: ['ARGELIA', 'ALGERIA', 'ALGÉRIE'],
  tunez: ['TUNEZ', 'TÚNEZ', 'TUNISIA', 'TUNISIE'],
  nigeria: ['NIGERIA', 'NIGÉRIA'],
  kenia: ['KENIA', 'KENYA'],
  // Ciudades/Provincias españolas importantes
  madrid: ['MADRID'],
  barcelona: ['BARCELONA'],
  valencia: ['VALENCIA'],
  sevilla: ['SEVILLA'],
  zaragoza: ['ZARAGOZA'],
  malaga: ['MALAGA', 'MÁLAGA'],
  murcia: ['MURCIA'],
  palma: ['PALMA', 'PALMA DE MALLORCA'],
  las_palmas: ['LAS PALMAS', 'LAS PALMAS DE GRAN CANARIA'],
  bilbao: ['BILBAO'],
  alicante: ['ALICANTE'],
  cordoba: ['CORDOBA', 'CÓRDOBA'],
  valladolid: ['VALLADOLID'],
  asturias: ['ASTURIAS', 'OVIEDO', 'GIJON', 'GIJÓN'],
  toledo: ['TOLEDO'],
  // Códigos postales comunes de España para detección
  postal_28: ['28001', '28002', '28003', '28004', '28005', '28006', '28007', '28008', '28009', '28010', '28' ], // Madrid
  postal_08: ['08001', '08002', '08003', '08004', '08005', '08006', '08007', '08008', '08009', '08010', '08' ], // Barcelona
  postal_46: ['46001', '46002', '46003', '46004', '46005', '46006', '46007', '46008', '46009', '46010', '46' ], // Valencia
  postal_41: ['41001', '41002', '41003', '41004', '41005', '41006', '41007', '41008', '41009', '41010', '41' ]  // Sevilla
};

// Función para buscar variantes de país o ciudad
export function buscarVariantesPais(busqueda: string): string[] {
  if (!busqueda || busqueda.trim() === '') return [];
  
  const upperSearchTerm = busqueda.toUpperCase();
  
  // Buscar en todas las variantes para encontrar coincidencias
  for (const [key, variants] of Object.entries(listaVariantesPaises)) {
    // Si el término de búsqueda está incluido en alguna variante o viceversa
    if (variants.some(v => v.includes(upperSearchTerm) || upperSearchTerm.includes(v))) {
      console.log(`Coincidencia detectada con ${key}: ${variants.join(', ')}`);
      return variants;
    }
  }
  
  // Si no encontramos coincidencias exactas, intentar con el término normalizado
  const normalizedSearch = normalizeText(busqueda);
  
  for (const [key, variants] of Object.entries(listaVariantesPaises)) {
    // Normalizar también las variantes para comparar
    const normalizedVariants = variants.map(v => normalizeText(v));
    
    if (normalizedVariants.some(v => v.includes(normalizedSearch) || normalizedSearch.includes(v))) {
      console.log(`Coincidencia detectada con normalización para ${key}: ${variants.join(', ')}`);
      return variants;
    }
  }
  
  return [];
}

// Función para construir condiciones SQL para búsqueda de ubicación
export function construirCondicionesUbicacion(columna: string, termino: string): string {
  const upperSearchTerm = termino.toUpperCase();
  const variantes = buscarVariantesPais(termino);
  
  let sqlCondition = `${columna} = '${upperSearchTerm}' OR
    ${columna} LIKE '%${upperSearchTerm}%'`;
  
  // Agregar variantes si existen
  if (variantes.length > 0) {
    const variantesCondition = variantes.map(v => `${columna} = '${v}' OR ${columna} LIKE '%${v}%'`).join(' OR ');
    sqlCondition += ` OR ${variantesCondition}`;
  }
  
  // Buscar por términos normalizados (sin acentos)
  const normalizedTerm = normalizeText(termino);
  
  // Si el término normalizado es diferente del original, añadir condiciones para buscar sin acentos
  if (normalizedTerm !== termino.toLowerCase()) {
    // Estas condiciones son aproximaciones ya que SQLite no tiene una función directa para eliminar acentos
    // pero ayudan a encontrar coincidencias con caracteres normalizados
    sqlCondition += ` OR LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      ${columna},
      'á', 'a'),
      'é', 'e'),
      'í', 'i'),
      'ó', 'o'),
      'ú', 'u'),
      'ñ', 'n')
    ) LIKE '%${normalizedTerm}%'`;
  }
  
  return sqlCondition;
}

// Función para extraer códigos postales de un texto para búsqueda mejorada
export function extraerCodigoPostal(texto: string): string | null {
  if (!texto) return null;
  
  // Patrones comunes de códigos postales españoles (5 dígitos)
  const match = texto.match(/\b\d{5}\b/);
  if (match) {
    return match[0];
  }
  
  return null;
}

// Función para procesar campos de ubicación compleja (Ej: "Madrid, España")
export function procesarUbicacionCompleja(ubicacion: string): { ciudad?: string, provincia?: string, pais?: string } {
  if (!ubicacion) return {};
  
  const resultado: { ciudad?: string, provincia?: string, pais?: string } = {};
  
  // Limpiar comillas y espacios extras
  const ubicacionLimpia = ubicacion.replace(/"/g, '').replace(/'/g, '').trim();
  
  // Si contiene comas, dividir en partes (común en formato "Ciudad, País")
  const partes = ubicacionLimpia.split(',').map(p => p.trim());
  
  if (partes.length > 1) {
    // Asumimos que el último elemento es el país
    resultado.pais = partes[partes.length - 1];
    
    // El primer elemento puede ser la ciudad o provincia
    resultado.ciudad = partes[0];
    
    // Si hay un elemento intermedio, puede ser la provincia
    if (partes.length > 2) {
      resultado.provincia = partes[1];
    }
  } else {
    // Si no hay coma, puede ser solo país o ciudad
    // Intentamos determinar si es país o ciudad usando el diccionario
    
    const esUnPais = Object.values(listaVariantesPaises).some(variantes => 
      variantes.some(v => normalizeText(v) === normalizeText(ubicacionLimpia))
    );
    
    if (esUnPais) {
      resultado.pais = ubicacionLimpia;
    } else {
      resultado.ciudad = ubicacionLimpia;
    }
  }
  
  return resultado;
}