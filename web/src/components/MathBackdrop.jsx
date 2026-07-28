import "./MathBackdrop.css";

/* Fondo temático del hero: papel cuadriculado (como un cuaderno de matemática)
   y unos pocos símbolos flotando muy tenues. Habla del oficio sin decir nada,
   y evita el fondo abstracto que usa cualquier sitio.

   Posiciones fijas y elegidas a mano: nada de aleatorio, así el resultado es
   siempre el mismo y no compite con el texto. Todo decorativo. */
const SYMBOLS = [
  { char: "√", top: "12%", left: "6%", size: "clamp(2.5rem, 5vw, 4.5rem)", delay: "0s" },
  { char: "π", top: "68%", left: "11%", size: "clamp(2rem, 4vw, 3.6rem)", delay: "1.6s" },
  { char: "∑", top: "24%", left: "78%", size: "clamp(2.2rem, 4.5vw, 4rem)", delay: "0.8s" },
  { char: "∫", top: "78%", left: "68%", size: "clamp(2rem, 4vw, 3.4rem)", delay: "2.4s" },
  { char: "Δ", top: "46%", left: "88%", size: "clamp(1.8rem, 3.5vw, 3rem)", delay: "3.1s" },
  { char: "x²", top: "84%", left: "34%", size: "clamp(1.6rem, 3vw, 2.6rem)", delay: "1.2s" },
];

const MathBackdrop = () => (
  <div className="mbd" aria-hidden="true">
    <span className="mbd-paper" />
    {SYMBOLS.map((s) => (
      <span
        key={s.char}
        className="mbd-symbol"
        style={{
          top: s.top,
          left: s.left,
          fontSize: s.size,
          animationDelay: s.delay,
        }}
      >
        {s.char}
      </span>
    ))}
  </div>
);

export default MathBackdrop;
