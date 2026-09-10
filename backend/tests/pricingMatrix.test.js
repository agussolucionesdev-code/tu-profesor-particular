import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRICING_MATRIX,
  aplicarDescuento,
  cotizar,
  normalizarMatriz,
  resolverTarifa,
} from "../src/services/pricingMatrix.js";

/* La matriz de precios: nivel × materia → tarifa por hora.
 *
 * POR QUÉ EXISTE
 *
 * Había UN solo precio por hora para todo. Pero el precio real de Agustín es una
 * matriz: primaria no vale lo mismo que universitario, y dentro de secundaria las
 * ciencias duras valen más que Lengua. Con un único número, el kiosco mostraba un
 * estimado equivocado para casi toda combinación —y mostrar un precio MENOR al real y
 * corregirlo después es peor que no mostrar ninguno: es la reserva que hay que
 * cancelar.
 *
 * LA REGLA QUE NO SE PUEDE ROMPER, la misma de todo el módulo de precios:
 *
 *   Si una combinación no tiene tarifa, se devuelve null. NUNCA cero.
 *
 * Un cero se convierte en "$0" en pantalla y se lee como "es gratis": una promesa que
 * el negocio no hizo. Y el caso es real, no teórico — el profesor edita esto a mano
 * desde el panel y puede dejar un nivel sin cargar.
 *
 * POR QUÉ NO ES UNA IA. La entrada es nivel + materia + duración y la salida es un
 * número. Es determinística. Un modelo ahí sería no determinista (la misma reserva
 * podría cotizar distinto dos veces), podría alucinar un precio, costaría una llamada
 * por reserva y sería intesteable. Cuando la respuesta se puede escribir como regla,
 * se escribe.
 */

const matriz = (extra = {}) =>
  normalizarMatriz({
    porNivel: { Primaria: 16000, Secundaria: 20000 },
    excepciones: [
      { nivel: "Secundaria", materias: ["Matemática", "Física"], precio: 25000 },
    ],
    descuento: { desdeHoras: 2, porcentaje: 10 },
    ...extra,
  });

describe("resolver la tarifa de una combinación", () => {
  it("usa la base del nivel cuando la materia no tiene excepción", () => {
    expect(resolverTarifa(matriz(), { nivel: "Secundaria", materia: "Lengua y Literatura" }))
      .toBe(20000);
  });

  it("la excepción de la materia le gana a la base del nivel", () => {
    expect(resolverTarifa(matriz(), { nivel: "Secundaria", materia: "Física" })).toBe(25000);
  });

  it("una excepción vale SÓLO dentro de su nivel", () => {
    /* Matemática en secundaria son $25.000, pero en primaria es primaria. Sin esto, una
       excepción pensada para secundaria le encarecería la clase a un chico de 4° grado. */
    expect(resolverTarifa(matriz(), { nivel: "Primaria", materia: "Matemática" })).toBe(16000);
  });

  it("un nivel sin tarifa cargada devuelve null, no cero", () => {
    expect(resolverTarifa(matriz(), { nivel: "Universitario", materia: "Física" })).toBe(null);
  });

  it("un nivel que no existe devuelve null", () => {
    // Llega del cliente: puede venir cualquier cosa.
    expect(resolverTarifa(matriz(), { nivel: "Posgrado", materia: "Física" })).toBe(null);
  });

  it("sin nivel no hay tarifa", () => {
    for (const nivel of [null, undefined, "", "   "]) {
      expect(resolverTarifa(matriz(), { nivel, materia: "Física" })).toBe(null);
    }
  });

  it("sin materia cae en la base del nivel", () => {
    /* La materia puede faltar —una reserva vieja, o el panel creando a mano— y eso no
       puede dejar sin precio a un nivel que sí tiene tarifa. */
    expect(resolverTarifa(matriz(), { nivel: "Secundaria", materia: null })).toBe(20000);
  });

  it("ignora mayúsculas y espacios al comparar la materia", () => {
    /* La materia llega como texto libre desde el paso 1 y también se puede escribir a
       mano con "Otra materia". "  física  " y "Física" son la misma clase. */
    for (const escrita of ["física", "  Física  ", "FÍSICA"]) {
      expect(resolverTarifa(matriz(), { nivel: "Secundaria", materia: escrita })).toBe(25000);
    }
  });

  it("cae en la tarifa general cuando la matriz no cubre la combinación", () => {
    /* Es la red de última instancia: `booking.pricePerHour`, el único número que existía
       antes de la matriz. Que siga funcionando es lo que hace que estrenar esto no le
       cambie el precio a nadie de un día para el otro. */
    expect(
      resolverTarifa(matriz(), { nivel: "Universitario", materia: "Física", tarifaGeneral: 30000 }),
    ).toBe(30000);
  });

  it("la matriz le gana a la tarifa general", () => {
    expect(
      resolverTarifa(matriz(), { nivel: "Secundaria", materia: "Física", tarifaGeneral: 9999 }),
    ).toBe(25000);
  });
});

describe("el nombre de la materia se compara normalizado", () => {
  /* ESTO EMPEZÓ COBRANDO DE MENOS, y estuvo meses en producción.

     El sitio institucional enlazaba `/reservar?materia=Matemáticas` —en plural,
     porque el título de la tarjeta allá dice "Matemáticas"— y el kiosco guardaba
     ese texto tal cual. La excepción está cargada como "Matemática", en singular,
     así que la comparación fallaba y la clase se cotizaba a la tarifa base:
     20.000 en lugar de 25.000. En la materia más pedida, y entrando desde el
     propio sitio.

     La causa se corrigió en el origen y en el kiosco, pero ESTA es la capa que
     garantiza el precio: los enlaces con el plural ya se compartieron por
     WhatsApp y van a seguir existiendo para siempre, y el servidor es el único
     lugar donde la tarifa se decide de verdad. */

  it("el plural del sitio cotiza igual que el singular del kiosco", () => {
    expect(resolverTarifa(matriz(), { nivel: "Secundaria", materia: "Matemáticas" }))
      .toBe(25000);
  });

  it("tolera mayúsculas, tildes ausentes y espacios de más", () => {
    for (const materia of ["MATEMATICA", "matematica", "  Matemática  ", "MATEMÁTICAS"]) {
      expect(resolverTarifa(matriz(), { nivel: "Secundaria", materia })).toBe(25000);
    }
  });

  it("NO adivina: una materia parecida no hereda la excepción", () => {
    /* El error opuesto, y es peor: cobrarle a alguien una tarifa que no eligió.
       "Mate" no es "Matemática" y tiene que caer en la base del nivel. */
    expect(resolverTarifa(matriz(), { nivel: "Secundaria", materia: "Mate" })).toBe(20000);
    expect(resolverTarifa(matriz(), { nivel: "Secundaria", materia: "Matemáticos" })).toBe(20000);
  });

  it("normalizar no rompe las materias que ya son plurales", () => {
    /* La "s" final se saca de los DOS lados de la comparación. Si se sacara de
       uno solo, "Ciencias Naturales" dejaría de coincidir consigo misma. */
    const m = matriz({
      excepciones: [
        { nivel: "Primaria", materias: ["Ciencias Naturales"], precio: 18000 },
      ],
    });
    expect(resolverTarifa(m, { nivel: "Primaria", materia: "Ciencias Naturales" })).toBe(18000);
  });
});

describe("descuento por varias horas", () => {
  it("no aplica por debajo del mínimo", () => {
    expect(aplicarDescuento(25000, 1, matriz().descuento)).toBe(25000);
    expect(aplicarDescuento(25000, 1.5, matriz().descuento)).toBe(25000);
  });

  it("aplica desde el mínimo configurado", () => {
    // −10% sobre 25000 = 22500, que es prácticamente el descuento que ya hacía a mano.
    expect(aplicarDescuento(25000, 2, matriz().descuento)).toBe(22500);
    expect(aplicarDescuento(25000, 3, matriz().descuento)).toBe(22500);
  });

  it("redondea a peso entero", () => {
    // Nadie cobra centavos en pesos, y un precio con coma ensucia el KPI de ingresos.
    expect(aplicarDescuento(16000, 2, { desdeHoras: 2, porcentaje: 13 })).toBe(13920);
    expect(Number.isInteger(aplicarDescuento(19999, 2, { desdeHoras: 2, porcentaje: 7 }))).toBe(true);
  });

  it("sin descuento configurado devuelve la tarifa intacta", () => {
    for (const d of [null, undefined, {}, { porcentaje: 0 }]) {
      expect(aplicarDescuento(25000, 4, d)).toBe(25000);
    }
  });

  it("un descuento imposible se ignora en lugar de regalar la clase", () => {
    /* Lo edita una persona: puede escribir 150 y dejar el precio en negativo. */
    for (const malo of [-10, 100, 150, "diez", NaN]) {
      expect(aplicarDescuento(25000, 2, { desdeHoras: 2, porcentaje: malo })).toBe(25000);
    }
  });
});

describe("cotizar una reserva completa", () => {
  it("devuelve la tarifa aplicada y el precio total", () => {
    const c = cotizar(matriz(), { nivel: "Secundaria", materia: "Física", duracionHoras: 2 });

    expect(c.tarifaBase).toBe(25000);
    expect(c.tarifaAplicada).toBe(22500);
    expect(c.price).toBe(45000);
    expect(c.huboDescuento).toBe(true);
  });

  it("sin descuento, la tarifa aplicada es la base", () => {
    const c = cotizar(matriz(), { nivel: "Secundaria", materia: "Física", duracionHoras: 1 });

    expect(c.tarifaBase).toBe(25000);
    expect(c.tarifaAplicada).toBe(25000);
    expect(c.price).toBe(25000);
    expect(c.huboDescuento).toBe(false);
  });

  it("sin tarifa para la combinación devuelve null entero, no una cotización en cero", () => {
    /* null y no `{price: 0}`: quien lo use tiene que decidir entre mostrar el bloque o
       no mostrarlo, en lugar de recibir ceros y tener que acordarse de chequearlos. */
    expect(cotizar(matriz(), { nivel: "Universitario", materia: "Física", duracionHoras: 2 }))
      .toBe(null);
  });

  it("sin duración usable devuelve null", () => {
    for (const d of [0, -1, null, undefined, "dos", NaN]) {
      expect(cotizar(matriz(), { nivel: "Secundaria", materia: "Física", duracionHoras: d }))
        .toBe(null);
    }
  });

  it("las medias horas no dejan centavos", () => {
    const c = cotizar(matriz(), { nivel: "Primaria", materia: "Matemática", duracionHoras: 0.5 });

    expect(c.price).toBe(8000);
    expect(Number.isInteger(c.price)).toBe(true);
  });
});

describe("normalizar lo que llega de la base", () => {
  /* La matriz la edita una persona desde el panel y se guarda como JSON. Puede llegar
     con cualquier forma, y una matriz corrupta no puede tumbar el paso 3 del kiosco ni
     la creación de una reserva. */

  it("una matriz que no es objeto queda vacía y no rompe", () => {
    for (const basura of [null, undefined, "", 42, [], "una matriz"]) {
      const m = normalizarMatriz(basura);
      expect(m.porNivel).toEqual({});
      expect(m.excepciones).toEqual([]);
      expect(resolverTarifa(m, { nivel: "Secundaria", materia: "Física" })).toBe(null);
    }
  });

  it("descarta tarifas que no son números usables", () => {
    const m = normalizarMatriz({
      porNivel: { Primaria: 0, Secundaria: -100, Terciario: "veinte mil", Universitario: 30000 },
    });

    expect(m.porNivel).toEqual({ Universitario: 30000 });
  });

  it("descarta excepciones mal formadas sin perder las buenas", () => {
    const m = normalizarMatriz({
      porNivel: { Secundaria: 20000 },
      excepciones: [
        { nivel: "Secundaria", materias: ["Física"], precio: 25000 },
        { nivel: "Secundaria", materias: [], precio: 25000 },
        { nivel: "", materias: ["Química"], precio: 25000 },
        { nivel: "Secundaria", materias: ["Química"], precio: 0 },
        "no soy una excepción",
        null,
      ],
    });

    expect(m.excepciones).toHaveLength(1);
    expect(resolverTarifa(m, { nivel: "Secundaria", materia: "Física" })).toBe(25000);
    // La que tenía precio 0 se descartó, así que Química cae en la base del nivel.
    expect(resolverTarifa(m, { nivel: "Secundaria", materia: "Química" })).toBe(20000);
  });

  it("es idempotente: normalizar lo ya normalizado no cambia nada", () => {
    const una = normalizarMatriz(DEFAULT_PRICING_MATRIX);
    expect(normalizarMatriz(una)).toEqual(una);
  });
});

describe("los valores por defecto son los que acordó el profesor", () => {
  const m = normalizarMatriz(DEFAULT_PRICING_MATRIX);

  it("primaria pasa a la tarifa de mercado", () => {
    /* Cobraba $12.000 cuando el piso relevado era $16.140. No es un aumento: es dejar de
       estar por debajo del piso. */
    expect(resolverTarifa(m, { nivel: "Primaria", materia: "Matemática" })).toBe(16000);
  });

  it("secundaria distingue las ciencias duras", () => {
    expect(resolverTarifa(m, { nivel: "Secundaria", materia: "Lengua y Literatura" })).toBe(20000);
    for (const dura of ["Matemática", "Física", "Química", "Fisicoquímica"]) {
      expect(resolverTarifa(m, { nivel: "Secundaria", materia: dura })).toBe(25000);
    }
  });

  it("terciario y universitario van al mismo valor", () => {
    expect(resolverTarifa(m, { nivel: "Terciario", materia: "Pedagogía" })).toBe(30000);
    expect(resolverTarifa(m, { nivel: "Universitario", materia: "Física" })).toBe(30000);
  });

  it("el descuento arranca en 2 horas y es del 10%", () => {
    /* Coincide con la duración que el wizard ya recomienda por defecto: el precio y el
       producto empujan para el mismo lado. */
    expect(m.descuento.desdeHoras).toBe(2);
    expect(m.descuento.porcentaje).toBe(10);
  });

  it("NO trae un nivel de Programación", () => {
    // Decisión explícita de Agustín: la da, pero no la cobra aparte.
    expect(Object.keys(m.porNivel)).not.toContain("Programación");
    expect(JSON.stringify(m)).not.toMatch(/Programaci/i);
  });
});
