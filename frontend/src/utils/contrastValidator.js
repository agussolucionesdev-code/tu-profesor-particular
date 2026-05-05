const parseColor = (color) => {
  const ctx = document.createElement("canvas").getContext("2d"); ctx.fillStyle = color; const parsed = ctx.fillStyle;
  const match = parsed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
  const hex = parsed.replace("#", "");
  if (hex.length === 3) return { r: parseInt(hex[0]+hex[0],16), g: parseInt(hex[1]+hex[1],16), b: parseInt(hex[2]+hex[2],16) };
  if (hex.length === 6) return { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16) };
  return { r: 0, g: 0, b: 0 };
};

const relativeLuminance = ({ r, g, b }) => {
  const [rs, gs, bs] = [r, g, b].map((c) => { const sRGB = c/255; return sRGB <= 0.03928 ? sRGB/12.92 : Math.pow((sRGB+0.055)/1.055, 2.4); });
  return 0.2126*rs + 0.7152*gs + 0.0722*bs;
};

export const calculateContrastRatio = (color1, color2) => {
  const lum1 = relativeLuminance(parseColor(color1)), lum2 = relativeLuminance(parseColor(color2));
  const lighter = Math.max(lum1, lum2), darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
};

export const validateColorPair = (foreground, background, wcagLevel = "AA") => {
  const ratio = calculateContrastRatio(foreground, background);
  const requirements = { AA: { normal: 4.5, large: 3 }, AAA: { normal: 7, large: 4.5 } };
  const { normal, large } = requirements[wcagLevel] || requirements.AA;
  return { ratio: Math.round(ratio*100)/100, passes: { normal: ratio >= normal, large: ratio >= large }, wcagLevel, recommendation: ratio >= normal ? "✅ Cumple WCAG "+wcagLevel : ratio >= 3 ? "⚠️ Solo texto grande" : "❌ No cumple WCAG AA" };
};

export const suggestBetterContrast = (foreground, background, targetRatio = 4.5) => {
  const bgLum = relativeLuminance(parseColor(background)), isDarkBg = bgLum < 0.5;
  const suggestions = [];
  const variants = isDarkBg ? ["#ffffff","#f8fafc","#f1f5f9","#edf6ee","#fef3c7"] : ["#0f172a","#1e293b","#334155","#183858","#166534"];
  variants.forEach((color) => { const ratio = calculateContrastRatio(color, background); if (ratio >= targetRatio) suggestions.push({ color, ratio: Math.round(ratio*100)/100, reason: isDarkBg ? "Texto más claro" : "Texto más oscuro" }); });
  return suggestions.sort((a,b) => b.ratio - a.ratio).slice(0,3);
};

export const validateTheme = (themeVars, wcagLevel = "AA") => {
  const criticalPairs = [
    { name: "Texto principal/Fondo", fg: themeVars["--brand-gray-900"]||"#0f172a", bg: themeVars["--brand-white"]||"#ffffff" },
    { name: "Texto secundario/Fondo", fg: themeVars["--brand-gray-600"]||"#475569", bg: themeVars["--brand-white"]||"#ffffff" },
    { name: "Texto sobre Navy", fg: themeVars["--brand-white"]||"#ffffff", bg: themeVars["--brand-navy"]||"#204060" },
    { name: "Texto sobre Green", fg: themeVars["--brand-white"]||"#ffffff", bg: themeVars["--brand-green"]||"#589860" },
    { name: "Texto sobre Accent", fg: themeVars["--brand-gray-900"]||"#0f172a", bg: themeVars["--brand-accent-warm"]||"#f59e0b" },
    { name: "Links/Fondo", fg: themeVars["--brand-green"]||"#589860", bg: themeVars["--brand-white"]||"#ffffff" },
    { name: "Texto sobre Green Soft", fg: themeVars["--brand-navy-deep"]||"#183858", bg: themeVars["--brand-green-soft"]||"#edf6ee" },
  ];
  const results = criticalPairs.map(({name,fg,bg}) => { const v = validateColorPair(fg,bg,wcagLevel); return { pair:name, foreground:fg, background:bg, ...v, suggestions: v.passes.normal ? [] : suggestBetterContrast(fg,bg) }; });
  const summary = { total: results.length, passing: results.filter(r=>r.passes.normal).length, failing: results.filter(r=>!r.passes.normal).length };
  return { results, summary, allPass: summary.failing===0, report: () => { console.group("🎨 Contraste WCAG "+wcagLevel); results.forEach(r=>console.log(`${r.passes.normal?"✅":r.passes.large?"⚠️ ":"❌"} ${r.pair}: ${r.ratio}:1 ${r.recommendation}`)); console.groupEnd(); } };
};

export const getContrastPreview = (fg, bg, text="Texto Aa123") => ({ foreground:fg, background:bg, text, ratio: calculateContrastRatio(fg,bg), previewStyle: { color:fg, backgroundColor:bg, padding:"8px 12px", borderRadius:"4px", display:"inline-block", fontFamily:"system-ui,sans-serif", fontSize:"14px" } });

export default { calculateContrastRatio, validateColorPair, suggestBetterContrast, validateTheme, getContrastPreview };
