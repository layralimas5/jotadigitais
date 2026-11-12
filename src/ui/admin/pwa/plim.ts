/** "Plim" com o painel aberto quando chega aviso novo no sininho. Preferência de cada aparelho. */
const PLIM_KEY = "jota:plim";

export function plimEnabled(): boolean {
  try {
    return window.localStorage.getItem(PLIM_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setPlimEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(PLIM_KEY, enabled ? "on" : "off");
  } catch (error) {
    console.error("Não foi possível guardar a preferência do som", error);
  }
}

let context: AudioContext | null = null;

/** Duas notas curtas e suaves, geradas na hora (sem arquivo de som para baixar). */
export function playPlim(): void {
  try {
    context ??= new AudioContext();
    const audio = context;
    void audio.resume();
    const start = audio.currentTime + 0.01;
    [
      { frequency: 880, at: 0 },
      { frequency: 1318.5, at: 0.11 },
    ].forEach(({ frequency, at }) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start + at);
      gain.gain.linearRampToValueAtTime(0.18, start + at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.45);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start + at);
      oscillator.stop(start + at + 0.5);
    });
  } catch (error) {
    // Sem som não quebra nada: o aviso continua no sininho.
    console.warn("Não foi possível tocar o aviso sonoro", error);
  }
}
