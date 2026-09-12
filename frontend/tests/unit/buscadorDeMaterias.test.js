import test from "node:test";
import assert from "node:assert/strict";

import {
  buscarMaterias,
  normalizar,
  consultaEsCBC,
  CBC,
  MATERIAS_SUPERIOR,
} from "../../src/constants/materiasSuperior.js";

/* ══════════════════════════════════════════════════════════════════════════
   EL BUSCADOR DE MATERIAS DE TERCIARIO Y UNIVERSITARIO.

   Lo que estos tests protegen es una sola promesa: que la persona escriba
   como escriba —con tilde, sin tilde, en mayúscula, en minúscula, con
   espacios de más— encuentre su materia, y que el PRIMER resultado sea el
   obvio.

   Lo de "el primero" no es un lujo. La primera versión pasaba un test más
   flojo que sólo miraba si la materia estaba en la lista, y con ese criterio
   escribir "física" devolvía BIOFÍSICA arriba: su alias "fisica biologica"
   también arranca con "fisica" y el desempate alfabético ponía la B antes que
   la F. El test no lo vio porque preguntaba lo que no importaba.
   ══════════════════════════════════════════════════════════════════════════ */

test("normalizar saca tildes, baja a minúsculas y recorta espacios", () => {
  assert.equal(normalizar("Análisis"), "analisis");
  assert.equal(normalizar("QUÍMICA"), "quimica");
  assert.equal(normalizar("  Biología  "), "biologia");
  assert.equal(normalizar("mAtEmÁtIcA"), "matematica");
});

test("se encuentra la materia escriba como escriba", () => {
  const formas = [
    ["física", "Física (CBC)"],
    ["FISICA", "Física (CBC)"],
    ["fisica", "Física (CBC)"],
    ["Física", "Física (CBC)"],
    ["matemática", "Matemática (CBC)"],
    ["MATEMATICA", "Matemática (CBC)"],
    ["mAtEmAtIcA", "Matemática (CBC)"],
    ["química", "Química (CBC)"],
    ["QUIMICA", "Química (CBC)"],
    ["biología", "Biología (CBC)"],
    ["BIOLOGIA", "Biología (CBC)"],
    ["  biologia  ", "Biología (CBC)"],
    ["álgebra", "Álgebra Lineal"],
    ["ALGEBRA", "Álgebra Lineal"],
    ["análisis", "Análisis Matemático I"],
    ["ANALISIS", "Análisis Matemático I"],
    ["inglés", "Inglés I"],
    ["INGLES", "Inglés I"],
    ["orgánica", "Química Orgánica"],
    ["ORGANICA", "Química Orgánica"],
  ];

  for (const [escrito, esperado] of formas) {
    const primero = buscarMaterias(escrito)[0]?.nombre;
    assert.equal(
      primero,
      esperado,
      `escribiendo ${JSON.stringify(escrito)} el primer resultado debería ser ${esperado}, fue ${primero}`,
    );
  }
});

test("busca por cualquier parte del nombre, no sólo por el principio", () => {
  // Quien escribe "lineal" tiene que encontrar Álgebra Lineal. El <datalist>
  // nativo del navegador no hace esto, y por eso el buscador es propio.
  assert.equal(buscarMaterias("lineal")[0].nombre, "Álgebra Lineal");
  assert.equal(buscarMaterias("discreta")[0].nombre, "Matemática Discreta");
});

test("encuentra por los apodos con que la gente nombra las materias", () => {
  assert.equal(buscarMaterias("amII")[0].nombre, "Análisis Matemático II");
  assert.equal(buscarMaterias("aga")[0].nombre, "Álgebra y Geometría Analítica");
  assert.equal(buscarMaterias("termo")[0].nombre, "Termodinámica");
  assert.ok(buscarMaterias("integrales").some((m) => m.nombre.includes("Cálculo")));
});

test("una o ninguna letra no dispara resultados", () => {
  // Con una sola letra saldría media lista y no ayuda a nadie.
  assert.deepEqual(buscarMaterias(""), []);
  assert.deepEqual(buscarMaterias("a"), []);
  assert.deepEqual(buscarMaterias("   "), []);
});

test("no ofrece materias que Agustín no da", () => {
  // La lista de Secundaria alguna vez incluyó Derecho Penal y Antropología, y
  // un turno que después hay que cancelar cuesta más que no ofrecerlo. Quien
  // busca eso tiene que caer en "escribir otra materia", no encontrarlo acá.
  for (const ajena of ["antropologia", "derecho", "contabilidad", "programacion", "historia del arte"]) {
    assert.deepEqual(
      buscarMaterias(ajena),
      [],
      `"${ajena}" no debería aparecer: no se dicta`,
    );
  }
});

test("el CBC es un grupo propio con las cuatro materias que se dan", () => {
  assert.deepEqual(CBC.materias, [
    "Matemática (CBC)",
    "Física (CBC)",
    "Química (CBC)",
    "Biología (CBC)",
  ]);
  for (const escrito of ["cbc", "CBC", "ciclo basico", "Ciclo Básico", "uba", "ingreso"]) {
    assert.equal(consultaEsCBC(escrito), true, `"${escrito}" debería levantar el bloque del CBC`);
  }
  assert.equal(consultaEsCBC("quimica organica"), false);
});

test("toda materia declara familia y al menos un apodo de búsqueda", () => {
  for (const m of MATERIAS_SUPERIOR) {
    assert.ok(m.nombre?.trim(), "hay una materia sin nombre");
    assert.ok(m.familia?.trim(), `${m.nombre} no declara familia`);
    assert.ok(Array.isArray(m.busca) && m.busca.length > 0, `${m.nombre} no tiene apodos de búsqueda`);
  }
});

test("no hay materias repetidas", () => {
  const nombres = MATERIAS_SUPERIOR.map((m) => m.nombre);
  assert.equal(new Set(nombres).size, nombres.length, "hay nombres duplicados en la lista");
});
