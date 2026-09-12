import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBookingWizard } from "../../src/hooks/useBookingWizard";

/* CUÁNDO UN CAMPO SE PONE EN ROJO.

   Premiar temprano, retar tarde. El verde puede aparecer apenas el dato está
   bien, pero el rojo espera a que la persona deje el campo o intente avanzar.

   Antes el error aparecía con la primera letra. Medido en el paso 4, en un
   teléfono: escribiendo «lucia.f», con el foco todavía en el campo, el
   formulario ya decía «parece que le falta el @». La persona no había llegado
   a escribir el @. Con un email se ve enseguida, pero pasaba igual con el
   nombre —«Lu» no pasa la validación de tres letras— y con el teléfono a
   partir del cuarto dígito. Un formulario que reta mientras se escribe se
   siente hostil y es más lento: la persona frena a leer un error que no es un
   error. */

const escribir = (hook, name, value) =>
  act(() => hook.result.current.handleChange({ target: { name, value } }));

const salir = (hook, name) =>
  act(() => hook.result.current.handleBlur({ target: { name } }));

const montar = () => renderHook(() => useBookingWizard(() => {}));

describe("validación de campos: premiar temprano, retar tarde", () => {
  it("no reta mientras la persona sigue escribiendo", () => {
    const hook = montar();
    escribir(hook, "email", "lucia.f");

    expect(hook.result.current.getFieldStateClass("email", true)).toBe("");
    expect(hook.result.current.getFieldError("email", true)).toBeNull();
  });

  it("reta cuando la persona deja el campo con un dato mal escrito", () => {
    const hook = montar();
    escribir(hook, "email", "lucia.f");
    salir(hook, "email");

    expect(hook.result.current.getFieldStateClass("email", true)).toBe("error");
    expect(hook.result.current.getFieldError("email", true)).toMatch(/@/);
  });

  it("premia apenas el dato está bien, sin esperar a que salga del campo", () => {
    const hook = montar();
    escribir(hook, "email", "lucia.f@gmail.com");

    expect(hook.result.current.getFieldStateClass("email", true)).toBe("is-valid");
  });

  it("una vez retado, el error sigue a la vista mientras corrige y se va al quedar bien", () => {
    const hook = montar();
    escribir(hook, "email", "lucia.f");
    salir(hook, "email");

    // Vuelve a escribir y todavía no está: el aviso no parpadea.
    escribir(hook, "email", "lucia.f@gmail");
    expect(hook.result.current.getFieldStateClass("email", true)).toBe("error");

    escribir(hook, "email", "lucia.f@gmail.com");
    expect(hook.result.current.getFieldStateClass("email", true)).toBe("is-valid");
  });

  it("pasar por un obligatorio vacío no lo pone en rojo: eso espera al intento de avanzar", () => {
    /* Quien recorre el formulario con Tab o tocando campos para ver qué hay
       no tiene que dejar una estela roja detrás. Lo vacío se reclama cuando
       intenta seguir. */
    const hook = montar();
    salir(hook, "studentName");
    expect(hook.result.current.getFieldStateClass("studentName")).toBe("");

    act(() => hook.result.current.setHasAttemptedNext(true));
    expect(hook.result.current.getFieldStateClass("studentName")).toBe("error");
  });

  it("el nombre corto y el teléfono incompleto tampoco retan antes de salir", () => {
    const hook = montar();
    escribir(hook, "studentName", "Lu");
    escribir(hook, "phone", "11333");

    expect(hook.result.current.getFieldStateClass("studentName")).toBe("");
    expect(hook.result.current.getFieldStateClass("phone")).toBe("");

    salir(hook, "phone");
    expect(hook.result.current.getFieldStateClass("phone")).toBe("error");
    // El nombre sigue sin tocar: no se contagia.
    expect(hook.result.current.getFieldStateClass("studentName")).toBe("");
  });

  it("empezar de nuevo olvida qué campos se habían dejado", () => {
    const hook = montar();
    escribir(hook, "email", "lucia.f");
    salir(hook, "email");
    act(() => hook.result.current.resetForm());

    escribir(hook, "email", "otro.");
    expect(hook.result.current.getFieldStateClass("email", true)).toBe("");
  });
});
