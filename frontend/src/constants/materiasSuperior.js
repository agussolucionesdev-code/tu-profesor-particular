/* ══════════════════════════════════════════════════════════════════════════
   LAS MATERIAS DE TERCIARIO Y UNIVERSITARIO, PARA EL BUSCADOR.

   POR QUÉ ESTO NO ES UNA GRILLA DE TARJETAS

   Primaria tiene 5 materias y Secundaria 7: entran en una grilla y se eligen
   de un vistazo. Terciario y Universitario no funcionan así. La misma materia
   cambia de nombre según la carrera y la facultad: lo que en el CBC es
   "Matemática", en Exactas es "Análisis Matemático I" y en la UTN es "Álgebra
   y Geometría Analítica". Una grilla que intentara cubrir eso tendría cien
   tarjetas y no la recorrería nadie.

   Por eso acá se escribe y el buscador filtra.

   QUÉ ENTRA EN ESTA LISTA, Y QUÉ NO

   Sólo los nombres de nivel superior de las materias que Agustín DA. Nada más.

   La tentación era cargar el plan completo de las facultades para que el
   buscador "tenga de todo". Sería un error, y ya está documentado en este
   repo: la lista de Secundaria alguna vez incluyó Derecho Penal, Contabilidad
   y Antropología, y ofrecer un turno que después hay que cancelar cuesta más
   que no ofrecerlo. Alguien que busca Antropología Social no tiene que
   encontrarla acá: tiene que caer en "otra materia" y escribirla, y ahí
   Agustín decide.

   Entonces la regla es: cobertura generosa de lo propio, cero de lo ajeno.

   POR QUÉ CADA MATERIA TIENE `busca`

   Quien escribe en el buscador no escribe el nombre canónico. Escribe
   "analisis" sin tilde, o "mate", o "algebra lineal", o "amii". El campo
   `busca` son los términos por los que esa materia TIENE que aparecer, y se
   normalizan igual que lo tipeado: sin tildes, en minúsculas. El nombre
   canónico también se busca, no hace falta repetirlo ahí.

   Nombres verificados contra los planes públicos de UTN Buenos Aires y el
   Ciclo Básico Común de la UBA (septiembre de 2026).
   ══════════════════════════════════════════════════════════════════════════ */

export const MATERIAS_SUPERIOR = [
  /* ── Matemática ────────────────────────────────────────────────────────── */
  { nombre: "Análisis Matemático I", familia: "Matemática", busca: ["amI", "am1", "analisis 1", "calculo 1", "analisis matematico uno"] },
  { nombre: "Análisis Matemático II", familia: "Matemática", busca: ["amII", "am2", "analisis 2", "calculo 2"] },
  { nombre: "Análisis Matemático III", familia: "Matemática", busca: ["amIII", "am3", "analisis 3"] },
  { nombre: "Cálculo Diferencial e Integral", familia: "Matemática", busca: ["calculo", "derivadas", "integrales"] },
  { nombre: "Álgebra y Geometría Analítica", familia: "Matemática", busca: ["aga", "algebra utn", "geometria analitica"] },
  { nombre: "Álgebra Lineal", familia: "Matemática", busca: ["matrices", "vectores", "espacios vectoriales"] },
  { nombre: "Matemática (CBC)", cbc: true, familia: "Matemática", busca: ["cbc", "matematica cbc", "ingreso uba"] },
  { nombre: "Matemática Discreta", familia: "Matemática", busca: ["discreta", "logica y estructuras discretas", "combinatoria"] },
  { nombre: "Probabilidad y Estadística", familia: "Matemática", busca: ["estadistica", "probabilidad", "pye"] },
  { nombre: "Matemática Financiera", familia: "Matemática", busca: ["financiera", "interes compuesto"] },

  /* ── Física ────────────────────────────────────────────────────────────── */
  { nombre: "Física (CBC)", cbc: true, familia: "Física", busca: ["cbc", "fisica cbc", "ingreso uba"] },
  { nombre: "Física I", familia: "Física", busca: ["f1", "fisica 1", "mecanica", "cinematica", "dinamica"] },
  { nombre: "Física II", familia: "Física", busca: ["f2", "fisica 2", "electricidad", "magnetismo"] },
  { nombre: "Termodinámica", familia: "Física", busca: ["termo", "calor", "entropia"] },
  { nombre: "Electromagnetismo", familia: "Física", busca: ["campos", "maxwell", "electro"] },
  { nombre: "Biofísica", familia: "Física", busca: ["fisica biologica", "medicina", "kinesiologia"] },

  /* ── Química ───────────────────────────────────────────────────────────── */
  { nombre: "Química (CBC)", cbc: true, familia: "Química", busca: ["cbc", "quimica cbc", "ingreso uba"] },
  { nombre: "Química General", familia: "Química", busca: ["quimica 1", "general e inorganica"] },
  { nombre: "Química Inorgánica", familia: "Química", busca: ["inorganica"] },
  { nombre: "Química Orgánica", familia: "Química", busca: ["organica", "carbono", "hidrocarburos"] },
  { nombre: "Química Analítica", familia: "Química", busca: ["analitica", "titulacion", "volumetria"] },
  { nombre: "Fisicoquímica", familia: "Química", busca: ["fisico quimica", "termoquimica", "cinetica quimica"] },
  { nombre: "Química Biológica", familia: "Química", busca: ["bioquimica", "metabolismo"] },

  /* ── Biología ──────────────────────────────────────────────────────────── */
  { nombre: "Biología (CBC)", cbc: true, familia: "Biología", busca: ["cbc", "biologia cbc", "ingreso uba"] },
  { nombre: "Biología Celular y Molecular", familia: "Biología", busca: ["celular", "molecular", "adn"] },
  { nombre: "Genética", familia: "Biología", busca: ["herencia", "mendel", "adn"] },
  { nombre: "Microbiología", familia: "Biología", busca: ["microbios", "bacterias"] },
  { nombre: "Histología", familia: "Biología", busca: ["tejidos"] },

  /* ── Inglés ────────────────────────────────────────────────────────────── */
  { nombre: "Inglés I", familia: "Inglés", busca: ["ingles 1", "english", "nivel 1"] },
  { nombre: "Inglés II", familia: "Inglés", busca: ["ingles 2", "english", "nivel 2"] },
  { nombre: "Inglés Técnico", familia: "Inglés", busca: ["tecnico", "lectocomprension", "textos tecnicos"] },
  { nombre: "Lengua Extranjera", familia: "Inglés", busca: ["idioma", "lengua extranjera"] },

  /* ── Lengua ────────────────────────────────────────────────────────────── */
  { nombre: "Lengua y Literatura", familia: "Lengua", busca: ["literatura", "lengua"] },
  { nombre: "Comprensión y Producción de Textos", familia: "Lengua", busca: ["textos", "escritura", "redaccion", "comprension lectora"] },
];

/* Saca tildes y pasa a minúsculas, para comparar lo tipeado contra la lista.
   "Análisis" y "analisis" tienen que ser lo mismo: nadie escribe tildes en un
   buscador, y menos desde el teléfono. */
export const normalizar = (texto = "") =>
  String(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("es-AR")
    .trim();

/* Busca por coincidencia en cualquier parte, no sólo al principio: quien
   escribe "lineal" tiene que encontrar "Álgebra Lineal". Ordena poniendo
   primero las que arrancan con lo tipeado, que son las que la persona
   probablemente está buscando. */
export const buscarMaterias = (consulta, limite = 8) => {
  const q = normalizar(consulta);
  if (q.length < 2) return [];

  const coincide = (m) => {
    const enNombre = normalizar(m.nombre).includes(q);
    const enAlias = m.busca.some((a) => normalizar(a).includes(q));
    const enFamilia = normalizar(m.familia).includes(q);
    return enNombre || enAlias || enFamilia;
  };

  /* El orden importa más de lo que parece. Con un solo escalón —"arranca con
     lo tipeado, sí o no"— escribir "física" devolvía BIOFÍSICA primero: su
     alias "fisica biologica" también arranca con "fisica", y el desempate
     alfabético ponía la B antes que la F. Quien escribe "física" espera
     Física, no Biofísica.

     Por eso hay cuatro escalones, del más literal al más flojo. */
  const rango = (m) => {
    const n = normalizar(m.nombre);
    if (n.startsWith(q)) return 0;                                  // el nombre arranca así
    if (m.busca.some((a) => normalizar(a).startsWith(q))) return 1; // un alias arranca así
    if (n.includes(q)) return 2;                                    // el nombre lo contiene
    return 3;                                                       // apareció por alias o familia
  };

  return MATERIAS_SUPERIOR.filter(coincide)
    .sort((a, b) => {
      const ra = rango(a);
      const rb = rango(b);
      if (ra !== rb) return ra - rb;
      return a.nombre.localeCompare(b.nombre, "es-AR");
    })
    .slice(0, limite);
};


/* ══════════════════════════════════════════════════════════════════════════
   EL CBC COMO PRODUCTO APARTE

   El Ciclo Básico Común no es "una materia más de universitario": es un
   momento con nombre propio, con fecha de parcial y con gente que llega
   apurada porque se le viene el final. Quien busca "preparación para el CBC"
   no está explorando un catálogo, ya sabe lo que necesita.

   Por eso el buscador lo muestra destacado arriba, antes de los resultados,
   en vez de esconderlo entre las demás. Las cuatro materias del CBC que
   Agustín da llevan `cbc: true` en la lista de arriba y también se pueden
   encontrar escribiendo.
   ══════════════════════════════════════════════════════════════════════════ */

export const CBC = {
  titulo: "Preparación para el CBC",
  bajada: "Matemática, Física, Química y Biología del Ciclo Básico Común de la UBA.",
  materias: MATERIAS_SUPERIOR.filter((m) => m.cbc).map((m) => m.nombre),
};

/* ¿Lo que se escribió apunta al CBC? Sirve para levantar el bloque destacado
   en cuanto alguien empieza a escribir "cbc", "ciclo basico" o "uba". */
export const consultaEsCBC = (consulta) => {
  const q = normalizar(consulta);
  if (q.length < 2) return false;
  return ["cbc", "ciclo basico", "ciclo basico comun", "uba", "ingreso"].some((t) =>
    normalizar(t).includes(q) || q.includes(normalizar(t)),
  );
};

/* Los niveles que usan buscador en vez de grilla. */
export const NIVELES_CON_BUSCADOR = ["Terciario", "Universitario"];

export const usaBuscador = (nivel) => NIVELES_CON_BUSCADOR.includes(nivel);
