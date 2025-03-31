// Función auxiliar para normalizar texto eliminando acentos y caracteres especiales
export function normalizeText(text: string): string {
  if (!text) return '';
  
  // Preservar el texto original para diagnóstico
  const original = text;
  console.log(`Normalizando texto: "${original}"`);
  
  try {
    // Eliminar comillas que pueden estar en los datos como "Madrid, España"
    let normalized = text.replace(/"/g, '').replace(/'/g, '');
    
    // Realizar primero normalizaciones especiales más específicas
    // Como la 'ú' en Perú, que a veces se pierde
    normalized = normalized.replace(/\bperu\b/gi, 'peru');
    normalized = normalized.replace(/\bperú\b/gi, 'peru');
    
    // Más países sudamericanos
    normalized = normalized.replace(/\bchile\b/gi, 'chile');
    normalized = normalized.replace(/\bargentina\b/gi, 'argentina');
    normalized = normalized.replace(/\bmexico\b/gi, 'mexico');
    normalized = normalized.replace(/\bméxico\b/gi, 'mexico');
    normalized = normalized.replace(/\bcolombia\b/gi, 'colombia');
    normalized = normalized.replace(/\becuador\b/gi, 'ecuador');
    normalized = normalized.replace(/\bvenezuela\b/gi, 'venezuela');
    normalized = normalized.replace(/\bparaguay\b/gi, 'paraguay');
    normalized = normalized.replace(/\buruguay\b/gi, 'uruguay');
    normalized = normalized.replace(/\bbolivia\b/gi, 'bolivia');
    
    // Países europeos con caracteres especiales
    normalized = normalized.replace(/\brumani?a\b/gi, 'rumania');
    normalized = normalized.replace(/\bromani?a\b/gi, 'rumania');
    normalized = normalized.replace(/\bespa[ñn]a\b/gi, 'espana');
    normalized = normalized.replace(/\balemani?a\b/gi, 'alemania');
    normalized = normalized.replace(/\bitalía\b/gi, 'italia');
    normalized = normalized.replace(/\bitalia\b/gi, 'italia');
    normalized = normalized.replace(/\bfrancia\b/gi, 'francia');
    
    // Reemplazos específicos para manejo adecuado de caracteres españoles
    // El orden es importante: primero reemplazar caracteres compuestos, luego individuales
    const replacements: {[key: string]: string} = {
      // Caracteres españoles
      'ñ': 'n', 'Ñ': 'n',
      'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'Á': 'a', 'À': 'a', 'Ä': 'a', 'Â': 'a',
      'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e', 'É': 'e', 'È': 'e', 'Ë': 'e', 'Ê': 'e',
      'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i', 'Í': 'i', 'Ì': 'i', 'Ï': 'i', 'Î': 'i',
      'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'Ó': 'o', 'Ò': 'o', 'Ö': 'o', 'Ô': 'o',
      'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u', 'Ú': 'u', 'Ù': 'u', 'Ü': 'u', 'Û': 'u',
      // Caracteres latinos adicionales
      'ç': 'c', 'Ç': 'c',
      'ã': 'a', 'Ã': 'a', 'õ': 'o', 'Õ': 'o', // Portugués
      'ø': 'o', 'Ø': 'o', 'æ': 'ae', 'Æ': 'ae', // Nórdicos
      'ß': 'ss', // Alemán
      'ł': 'l', 'Ł': 'l', // Polaco
      'œ': 'oe', 'Œ': 'oe', // Francés
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
    
    // Log detallado para análisis
    console.log(`Normalización mejorada: "${original}" → "${normalized}"`);
    
    // Detección especial para búsqueda de país individual
    if (['peru', 'rumani', 'rumania', 'espana'].includes(normalized)) {
      console.log(`¡Detección especial de país! "${normalized}"`);
    }
    
    return normalized;
  } catch (error) {
    console.error(`Error normalizando texto "${original}":`, error);
    // En caso de error, devolver una versión simple del texto
    return text.toLowerCase().trim();
  }
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
  
  const upperSearchTerm = busqueda.toUpperCase().trim();
  
  // Para búsquedas cortas (1 o 2 caracteres), necesitamos coincidir exactamente 
  // para evitar falsos positivos
  if (upperSearchTerm.length <= 2) {
    for (const [key, variants] of Object.entries(listaVariantesPaises)) {
      // Para búsquedas cortas, solo comparamos contra países que son exactamente estos códigos
      if (variants.some(v => v === upperSearchTerm)) {
        console.log(`Coincidencia exacta para código corto ${key}: ${variants.join(', ')}`);
        return variants;
      }
    }
    return []; // No encontramos coincidencias para búsquedas cortas
  }

  // Buscar primero coincidencias exactas
  for (const [key, variants] of Object.entries(listaVariantesPaises)) {
    if (variants.some(v => v === upperSearchTerm)) {
      console.log(`Coincidencia exacta detectada con ${key}: ${variants.join(', ')}`);
      return variants;
    }
  }
  
  // Buscar en todas las variantes para encontrar coincidencias parciales
  for (const [key, variants] of Object.entries(listaVariantesPaises)) {
    // Si el término de búsqueda está incluido en alguna variante o viceversa
    // Preferimos que la variante incluya el término de búsqueda, no al revés
    if (variants.some(v => v.includes(upperSearchTerm))) {
      console.log(`Coincidencia parcial detectada con ${key}: ${variants.join(', ')}`);
      return variants;
    }
  }
  
  // Otra pasada para verificar si el término de búsqueda incluye alguna variante
  // (menos preciso, pero útil para búsquedas como "MADRID, ESPAÑA")
  for (const [key, variants] of Object.entries(listaVariantesPaises)) {
    if (variants.some(v => upperSearchTerm.includes(v))) {
      console.log(`Coincidencia detectada (contiene) con ${key}: ${variants.join(', ')}`);
      return variants;
    }
  }
  
  // Si no encontramos coincidencias exactas, intentar con el término normalizado
  const normalizedSearch = normalizeText(busqueda);
  
  for (const [key, variants] of Object.entries(listaVariantesPaises)) {
    // Normalizar también las variantes para comparar
    const normalizedVariants = variants.map(v => normalizeText(v));
    
    // Intentar primero coincidencias exactas normalizadas
    if (normalizedVariants.some(v => v === normalizedSearch)) {
      console.log(`Coincidencia exacta normalizada para ${key}: ${variants.join(', ')}`);
      return variants;
    }
    
    // Luego buscar coincidencias parciales normalizadas
    if (normalizedVariants.some(v => v.includes(normalizedSearch) || normalizedSearch.includes(v))) {
      console.log(`Coincidencia parcial normalizada para ${key}: ${variants.join(', ')}`);
      return variants;
    }
  }
  
  return [];
}

// Función para construir condiciones SQL para búsqueda de ubicación
export function construirCondicionesUbicacion(columna: string, termino: string): string {
  if (!termino || termino.trim() === '') return `${columna} IS NOT NULL`;
  
  const upperSearchTerm = termino.toUpperCase();
  const variantes = buscarVariantesPais(termino);
  
  // Escapar comillas simples en el término de búsqueda para evitar inyección SQL
  const safeUpperTerm = upperSearchTerm.replace(/'/g, "''");
  
  // Condición básica: coincidencia exacta o contiene el término
  let sqlCondition = `${columna} = '${safeUpperTerm}' OR ${columna} LIKE '%${safeUpperTerm}%'`;
  
  // También buscar con TRIM para manejar espacios adicionales
  sqlCondition += ` OR TRIM(${columna}) = '${safeUpperTerm}' OR TRIM(${columna}) LIKE '%${safeUpperTerm}%'`;
  
  // Agregar también búsqueda en minúsculas
  const lowerSearchTerm = termino.toLowerCase().replace(/'/g, "''");
  sqlCondition += ` OR LOWER(${columna}) LIKE '%${lowerSearchTerm}%'`;
  sqlCondition += ` OR LOWER(TRIM(${columna})) LIKE '%${lowerSearchTerm}%'`;
  
  // Buscar sin comillas
  const cleanTerm = termino.replace(/"/g, '').replace(/'/g, '').trim();
  const safeCleanTerm = cleanTerm.replace(/'/g, "''");
  sqlCondition += ` OR ${columna} LIKE '%${safeCleanTerm}%'`;
  sqlCondition += ` OR LOWER(${columna}) LIKE '%${safeCleanTerm.toLowerCase()}%'`;
  
  // Agregar variantes si existen
  if (variantes.length > 0) {
    const variantesCondition = variantes.map(v => {
      const safeVariant = v.replace(/'/g, "''");
      return `${columna} = '${safeVariant}' OR ${columna} LIKE '%${safeVariant}%' OR LOWER(${columna}) LIKE '%${safeVariant.toLowerCase()}%'`;
    }).join(' OR ');
    
    sqlCondition += ` OR (${variantesCondition})`;
  }
  
  // Buscar por términos normalizados (sin acentos)
  const normalizedTerm = normalizeText(termino);
  
  // Si el término normalizado es diferente del original, añadir condiciones para buscar sin acentos
  if (normalizedTerm !== termino.toLowerCase()) {
    // Búsqueda de términos normalizados con seguridad para SQL
    const safeNormalizedTerm = normalizedTerm.replace(/'/g, "''");
    
    sqlCondition += ` OR LOWER(${columna}) LIKE '%${safeNormalizedTerm}%'`;
    
    // Estas condiciones son aproximaciones ya que SQLite no tiene una función directa para eliminar acentos
    sqlCondition += ` OR LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      ${columna},
      'á', 'a'),
      'é', 'e'),
      'í', 'i'),
      'ó', 'o'),
      'ú', 'u'),
      'ñ', 'n'),
      'Á', 'a'),
      'É', 'e')
    ) LIKE '%${safeNormalizedTerm}%'`;
    
    sqlCondition += ` OR LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
      ${columna},
      'Í', 'i'),
      'Ó', 'o'),
      'Ú', 'u'),
      'Ñ', 'n'),
      '"', '')
    ) LIKE '%${safeNormalizedTerm}%'`;
  }
  
  // Procesar para casos con estructura "Ciudad, País"
  const ubicacionProcesada = procesarUbicacionCompleja(termino);
  if (ubicacionProcesada.ciudad) {
    const safeCiudad = ubicacionProcesada.ciudad.replace(/'/g, "''");
    sqlCondition += ` OR ${columna} LIKE '%${safeCiudad}%'`;
    sqlCondition += ` OR LOWER(${columna}) LIKE '%${safeCiudad.toLowerCase()}%'`;
  }
  
  if (ubicacionProcesada.pais) {
    const safePais = ubicacionProcesada.pais.replace(/'/g, "''");
    sqlCondition += ` OR ${columna} LIKE '%${safePais}%'`;
    sqlCondition += ` OR LOWER(${columna}) LIKE '%${safePais.toLowerCase()}%'`;
  }
  
  // Buscar coincidencias parciales para ubicaciones compuestas
  if (termino.includes(',')) {
    const partes = termino.split(',').map(p => p.trim());
    partes.forEach(parte => {
      if (parte.length > 0) {
        const safeParte = parte.replace(/'/g, "''");
        sqlCondition += ` OR ${columna} LIKE '%${safeParte}%'`;
        sqlCondition += ` OR LOWER(${columna}) LIKE '%${safeParte.toLowerCase()}%'`;
      }
    });
  }
  
  // Manejar casos especiales como espacios al final/inicio o comillas
  sqlCondition += ` OR TRIM(${columna}) = '${safeUpperTerm.trim()}' OR TRIM(${columna}) LIKE '%${safeUpperTerm.trim()}%'`;
  
  // Asegurarse de que la condición está bien formada
  console.log(`Condición SQL generada para búsqueda de ubicación: ${sqlCondition}`);
  return `(${sqlCondition})`;
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
  
  try {
    // Conservar el valor original para logs
    const original = ubicacion;
    
    // Limpiar comillas y espacios extras
    const ubicacionLimpia = ubicacion.replace(/"/g, '').replace(/'/g, '').trim();
    
    // Log para depuración
    console.log(`Procesando ubicación compleja: "${original}" → "${ubicacionLimpia}"`);
    
    // Caso especial: Si la ubicación ya está en mayúsculas, probablemente es un país
    const esTodoMayusculas = ubicacionLimpia === ubicacionLimpia.toUpperCase() && ubicacionLimpia.length > 2;
    
    // Si contiene comas, dividir en partes (común en formato "Ciudad, País")
    if (ubicacionLimpia.includes(',')) {
      const partes = ubicacionLimpia.split(',').map(p => p.trim());
      
      console.log(`Ubicación dividida en ${partes.length} partes: ${partes.join(' | ')}`);
      
      if (partes.length > 1) {
        // Asumimos que el último elemento es el país
        const paisCandidato = partes[partes.length - 1];
        
        // Verificar si realmente es un país conocido
        const esPais = Object.values(listaVariantesPaises).some(variantes => 
          variantes.some(v => normalizeText(v) === normalizeText(paisCandidato) || 
                        paisCandidato.toUpperCase() === v ||
                        v.includes(paisCandidato.toUpperCase()))
        );
        
        if (esPais) {
          resultado.pais = paisCandidato;
          console.log(`País detectado: "${paisCandidato}"`);
        }
        
        // El primer elemento suele ser la ciudad
        const ciudadCandidata = partes[0];
        resultado.ciudad = ciudadCandidata;
        console.log(`Ciudad detectada: "${ciudadCandidata}"`);
        
        // Si hay un elemento intermedio, puede ser la provincia (solo si hay más de 2 partes)
        if (partes.length > 2) {
          resultado.provincia = partes[1];
          console.log(`Provincia detectada: "${partes[1]}"`);
        }
      }
    } else {
      // Si no hay coma, puede ser solo país o ciudad
      // Intentamos determinar si es país o ciudad usando el diccionario
      
      // Primero verificar coincidencia directa con países (más preciso)
      const esUnPais = Object.values(listaVariantesPaises).some(variantes => 
        variantes.some(v => {
          // Comparar normalizado o coincidencia exacta en mayúsculas
          return normalizeText(v) === normalizeText(ubicacionLimpia) || 
                v === ubicacionLimpia.toUpperCase() ||
                (esTodoMayusculas && v.includes(ubicacionLimpia));
        })
      );
      
      // Buscar coincidencia con ciudades/provincias españolas importantes
      const esUnaCiudad = ['madrid', 'barcelona', 'valencia', 'sevilla', 'zaragoza', 'malaga', 'bilbao'].includes(
        normalizeText(ubicacionLimpia)
      );
      
      if (esUnPais) {
        resultado.pais = ubicacionLimpia;
        console.log(`Ubicación identificada como país: "${ubicacionLimpia}"`);
      } else if (esUnaCiudad) {
        resultado.ciudad = ubicacionLimpia;
        console.log(`Ubicación identificada como ciudad española: "${ubicacionLimpia}"`);
      } else if (esTodoMayusculas) {
        // Si está todo en mayúsculas y no es una ciudad conocida, probablemente es un país
        resultado.pais = ubicacionLimpia;
        console.log(`Ubicación en mayúsculas asumida como país: "${ubicacionLimpia}"`);
      } else {
        // Por defecto, asumir que es una ciudad si no podemos determinar
        resultado.ciudad = ubicacionLimpia;
        console.log(`Ubicación asumida como ciudad por defecto: "${ubicacionLimpia}"`);
      }
    }
    
    // Verificación final: si no se identificó nada, guardar el valor original como ubicación
    if (!resultado.ciudad && !resultado.provincia && !resultado.pais) {
      console.log(`No se pudo procesar la ubicación "${original}" - guardando como ciudad por defecto`);
      resultado.ciudad = ubicacionLimpia;
    }
  } catch (error) {
    console.error(`Error procesando ubicación compleja "${ubicacion}":`, error);
    // En caso de error, devolver un objeto simple con la ciudad como valor de respaldo
    return { ciudad: ubicacion };
  }
  
  return resultado;
}