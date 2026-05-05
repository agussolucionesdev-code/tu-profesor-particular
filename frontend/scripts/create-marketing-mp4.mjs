import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, '..');
const projectRoot = path.resolve(frontendDir, '..');
const outputDir = path.join(projectRoot, 'artifacts', 'demo-video');
const toolsDir = path.join(outputDir, '.video-tools');

const inputWebm = path.join(outputDir, 'gestion-turnos-demo.webm');
const narrationMp3 = path.join(outputDir, 'narracion-es-ar.mp3');
const narrationMarkdown = path.join(outputDir, 'guion-narracion-publicitario.md');
const musicWav = path.join(outputDir, 'musica-suave-demo.wav');
const outputMp4 = path.join(outputDir, 'gestion-turnos-demo-publicitario.mp4');
const metadataTxt = path.join(outputDir, 'gestion-turnos-demo-publicitario.metadata.txt');

const narrationText = [
  'Con Tu Profesor Particular, reservar una clase es simple, claro y rápido.',
  'La familia entra al formulario, completa los datos del alumno, elige materia, fecha, horario y duración del encuentro.',
  'En pocos pasos, el sistema confirma la reserva y genera un código de seguimiento para consultar el turno cuando haga falta.',
  'Desde el portal, el alumno o su responsable puede revisar el detalle de la clase y gestionar cambios de manera ordenada.',
  'Y desde el panel administrador, el equipo tiene una vista práctica para acompañar cada reserva con más control y menos trabajo manual.',
  'Una experiencia pensada para que sacar un turno sea fácil, confiable y profesional.',
].join(' ');

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      ...options,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const error = new Error(`${command} ${args.join(' ')} failed with code ${code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

async function ensureTools() {
  const packageJson = path.join(toolsDir, 'package.json');
  const ffmpegPackage = path.join(toolsDir, 'node_modules', '@ffmpeg-installer', 'ffmpeg');
  const edgeTtsPackage = path.join(toolsDir, 'node_modules', 'node-edge-tts');

  if (existsSync(packageJson) && existsSync(ffmpegPackage) && existsSync(edgeTtsPackage)) {
    return;
  }

  await fs.mkdir(toolsDir, { recursive: true });
  await run('npm.cmd', [
    'install',
    '--prefix',
    toolsDir,
    '--no-audit',
    '--no-fund',
    '@ffmpeg-installer/ffmpeg',
    'node-edge-tts',
  ]);
}

function getToolsRequire() {
  return createRequire(path.join(toolsDir, 'package.json'));
}

async function synthesizeNarrationWithEdgeTts(file) {
  const edgeTtsCli = path.join(toolsDir, 'node_modules', 'node-edge-tts', 'bin.js');

  await run(process.execPath, [
    edgeTtsCli,
    '-t',
    narrationText,
    '-f',
    file,
    '-v',
    'es-AR-ElenaNeural',
    '-l',
    'es-AR',
    '-r',
    '+2%',
    '--timeout',
    '30000',
  ]);
}

async function synthesizeNarrationWithWindows(file) {
  const tempText = path.join(outputDir, 'narracion-es-ar.txt');
  const tempWav = path.join(outputDir, 'narracion-windows-fallback.wav');
  const tempScript = path.join(outputDir, 'narracion-windows-fallback.ps1');
  await fs.writeFile(tempText, narrationText, 'utf8');

  const script = [
    'param([string]$TextPath, [string]$OutputPath)',
    'Add-Type -AssemblyName System.Speech',
    '$text = Get-Content -Raw -Encoding UTF8 $TextPath',
    '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$synth.Rate = 0',
    '$synth.Volume = 100',
    '$synth.SetOutputToWaveFile($OutputPath)',
    '$synth.Speak($text)',
    '$synth.Dispose()',
  ].join('\n');

  await fs.writeFile(tempScript, script, 'utf8');
  await run('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    tempScript,
    tempText,
    tempWav,
  ]);

  const requireTools = getToolsRequire();
  const ffmpegPath = requireTools('@ffmpeg-installer/ffmpeg').path;
  await run(ffmpegPath, ['-y', '-i', tempWav, '-codec:a', 'libmp3lame', '-b:a', '128k', file]);
}

async function createNarration() {
  await fs.writeFile(
    narrationMarkdown,
    `# Guion de narracion publicitario\n\n${narrationText}\n\nVoz sugerida: es-AR-ElenaNeural.\n`,
    'utf8',
  );

  try {
    await synthesizeNarrationWithEdgeTts(narrationMp3);
  } catch (error) {
    console.warn(`Edge TTS failed, using Windows fallback voice: ${error.message}`);
    await synthesizeNarrationWithWindows(narrationMp3);
  }
}

async function createMusicBed(file) {
  const sampleRate = 44_100;
  const channels = 2;
  const seconds = 32;
  const totalFrames = sampleRate * seconds;
  const bytesPerSample = 2;
  const dataSize = totalFrames * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const chords = [
    [261.63, 329.63, 392.0, 523.25],
    [220.0, 277.18, 329.63, 440.0],
    [196.0, 246.94, 293.66, 392.0],
    [174.61, 220.0, 261.63, 349.23],
  ];

  let offset = 44;
  for (let frame = 0; frame < totalFrames; frame += 1) {
    const t = frame / sampleRate;
    const chord = chords[Math.floor(t / 8) % chords.length];
    const fadeIn = Math.min(1, t / 3);
    const fadeOut = Math.min(1, (seconds - t) / 3);
    const envelope = Math.max(0, Math.min(fadeIn, fadeOut));
    const shimmer = Math.sin(2 * Math.PI * 0.08 * t) * 0.03;
    const pad = chord.reduce((sum, frequency, index) => {
      const detune = 1 + Math.sin(t * 0.11 + index) * 0.0015;
      return sum + Math.sin(2 * Math.PI * frequency * detune * t + index * 0.4) * (0.13 / chord.length);
    }, 0);
    const bell = Math.sin(2 * Math.PI * 880 * t) * Math.max(0, 1 - ((t % 4) / 1.4)) * 0.012;
    const sample = Math.max(-1, Math.min(1, (pad + bell + shimmer) * envelope));
    const left = Math.round(sample * 32767);
    const right = Math.round(sample * 0.93 * 32767);

    buffer.writeInt16LE(left, offset);
    buffer.writeInt16LE(right, offset + 2);
    offset += 4;
  }

  await fs.writeFile(file, buffer);
}

async function createMp4() {
  const requireTools = getToolsRequire();
  const ffmpegPath = requireTools('@ffmpeg-installer/ffmpeg').path;
  const audioFilter =
    '[1:a]adelay=700|700,volume=1.35,apad[narr];' +
    '[2:a]volume=0.075,afade=t=in:st=0:d=2[music];' +
    '[narr][music]amix=inputs=2:duration=longest:dropout_transition=2[a]';

  await run(ffmpegPath, [
    '-y',
    '-i',
    inputWebm,
    '-i',
    narrationMp3,
    '-stream_loop',
    '-1',
    '-i',
    musicWav,
    '-filter_complex',
    audioFilter,
    '-map',
    '0:v:0',
    '-map',
    '[a]',
    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1',
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '21',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-ar',
    '48000',
    '-movflags',
    '+faststart',
    '-shortest',
    outputMp4,
  ]);

  const metadata = await run(ffmpegPath, ['-hide_banner', '-i', outputMp4, '-f', 'null', '-']);
  await fs.writeFile(metadataTxt, metadata.stderr || metadata.stdout, 'utf8');
  await run(ffmpegPath, ['-v', 'error', '-i', outputMp4, '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-']);
}

async function main() {
  if (!existsSync(inputWebm)) {
    throw new Error(`Input video not found: ${inputWebm}`);
  }

  await ensureTools();
  await createNarration();
  await createMusicBed(musicWav);
  await createMp4();

  const stats = await fs.stat(outputMp4);
  console.log(`MP4 ready: ${outputMp4}`);
  console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Narration: ${narrationMp3}`);
  console.log(`Music: ${musicWav}`);
  console.log(`Metadata: ${metadataTxt}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
