export const VOICE_PROFILES = {
  empathetic: { rate: 0.88, pitch: 1.06, volume: 1, lang: "es-AR", description: "Voz cálida y empática", pauses: { beforeImportant: 400, afterQuestion: 600, betweenSteps: 800 }, emphasis: { keywords: ["tranquilo", "sin apuro", "juntos", "confiá", "acá estoy"], technique: "pitch-boost" } },
  senior: { rate: 0.82, pitch: 1.02, volume: 1.1, lang: "es-AR", description: "Voz pausada para adultos mayores", repeatKeyInfo: true, pauses: { beforeImportant: 600, afterQuestion: 900, betweenSteps: 1200, afterCode: 1000 }, emphasis: { keywords: ["código", "fecha", "hora", "teléfono", "email"], technique: "repeat-slowly" }, spellOut: { codes: true, emails: false, phoneNumbers: true } },
  confirmation: { rate: 0.92, pitch: 1.08, volume: 1, lang: "es-AR", description: "Voz celebratoria para confirmaciones", emphasis: { keywords: ["confirmado", "listo", "éxito", "gracias", "reservado"], technique: "pitch-rise" }, pauses: { beforeConfirmation: 300, afterSuccess: 500 } },
  guidance: { rate: 0.9, pitch: 1.04, volume: 0.95, lang: "es-AR", description: "Voz guía para instrucciones", pauses: { betweenSteps: 700, afterInstruction: 500 }, emphasis: { keywords: ["primero", "después", "luego", "finalmente", "importante"], technique: "slight-pause" } },
  error: { rate: 0.85, pitch: 0.98, volume: 0.9, lang: "es-AR", description: "Voz calmante para errores", pauses: { beforeSolution: 600, afterReassurance: 400 }, emphasis: { keywords: ["no pasa nada", "tranquilo", "volvemos", "solución"], technique: "softer-tone" } },
};

export const interpolateVoiceMessage = (template, variables = {}, options = {}) => {
  const { spellCodes = false, spellEmails = false, emphasizeKeywords = true, profile = "empathetic" } = options;
  let message = template;
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    if (value === undefined || value === null) { message = message.replace(new RegExp(placeholder, "g"), ""); return; }
    let processedValue = String(value);
    if (spellCodes && key.toLowerCase().includes("code")) processedValue = spellForVoice(processedValue);
    if (spellEmails && key.toLowerCase().includes("email")) processedValue = spellEmailForVoice(processedValue);
    if (emphasizeKeywords && VOICE_PROFILES[profile]?.emphasis?.keywords) {
      VOICE_PROFILES[profile].emphasis.keywords.forEach((kw) => { const regex = new RegExp(`\\b${kw}\\b`, "gi"); if (regex.test(processedValue)) processedValue = processedValue.replace(regex, (m) => `*${m}*`); });
    }
    message = message.replace(new RegExp(placeholder, "g"), processedValue);
  });
  const pauses = VOICE_PROFILES[profile]?.pauses;
  if (pauses) message = message.replace(/\{pause:(\d+)\}/g, (_, ms) => " ".repeat(Math.floor(parseInt(ms) / 100)));
  return message.trim();
};

export const spellForVoice = (code, options = {}) => {
  const { separator = ", ", style = "letter-by-letter" } = options;
  if (style === "letter-by-letter") return code.toUpperCase().split("").map((char) => /\d/.test(char) ? `número ${char}` : /[A-Z]/.test(char) ? `letra ${char}` : char).join(separator);
  return code.split("").join(" ");
};

export const spellEmailForVoice = (email) => {
  const [local, domain] = email.split("@");
  const [domainName, tld] = domain.split(".");
  return [local.includes(".") ? local.split(".").join(" punto ") : local, "arroba", domainName, "punto", tld].join(" ");
};

export const getVoiceProfile = (profileName, overrides = {}) => {
  const baseProfile = VOICE_PROFILES[profileName] || VOICE_PROFILES.empathetic;
  return { ...baseProfile, ...overrides };
};

export const prepareVoiceAnnouncement = (message, profileName = "empathetic", options = {}) => {
  const profile = getVoiceProfile(profileName, options.profileOverrides);
  const processedMessage = interpolateVoiceMessage(message, options.variables, { ...options, profile: profileName });
  return { message: processedMessage, voiceOptions: { rate: profile.rate, pitch: profile.pitch, volume: profile.volume, lang: profile.lang }, metadata: { profile: profileName, hasPauses: !!profile.pauses, hasEmphasis: !!profile.emphasis, shouldRepeat: profile.repeatKeyInfo || false } };
};

export const speakWithProfile = (message, profileName = "empathetic", options = {}) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const { message: processedMessage, voiceOptions } = prepareVoiceAnnouncement(message, profileName, options);
  const utterance = new SpeechSynthesisUtterance(processedMessage.replace(/\*|\{/g, "").replace(/\}/g, ""));
  utterance.rate = voiceOptions.rate; utterance.pitch = voiceOptions.pitch; utterance.volume = voiceOptions.volume; utterance.lang = voiceOptions.lang;
  speechSynthesis.speak(utterance); return true;
};

export default { VOICE_PROFILES, interpolateVoiceMessage, spellForVoice, spellEmailForVoice, getVoiceProfile, prepareVoiceAnnouncement, speakWithProfile };
