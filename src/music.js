// BGM（ファミコン風の短いループ曲を Web Audio で鳴らす）
// 楽譜は 8分音符1つを1マスとして、空白区切りで書く。
//   "E5"  その高さの音を鳴らす（C4 = 真ん中のド、# でシャープ）
//   "-"   前の音をのばす
//   "."   休み
//   "|"   小節の区切り（読みやすくするためだけのもの）
// ドラムは k = バスドラ、s = スネア、h = ハイハット。

export const SONGS = {
  // タイトル: ゆっくり、ほんわか
  title: {
    bpm: 84,
    tracks: [
      {
        wave: 'triangle', gain: 0.22,
        notes: `E5 - G5 - C6 - B5 A5 | A5 - - - G5 - F5 - | D5 - G5 - B5 - A5 G5 | E5 - - - . . . . |
                C5 - E5 - A5 - G5 E5 | F5 - A5 - C6 - A5 - | G5 - F5 - E5 - D5 - | C5 - - - - - . .`,
      },
      {
        wave: 'sine', gain: 0.07,
        notes: `. G6 . E6 . G6 . E6 | . A6 . F6 . A6 . F6 | . B6 . G6 . B6 . G6 | . G6 . E6 . C6 . . |
                . A6 . E6 . A6 . E6 | . A6 . F6 . C7 . A6 | . B6 . G6 . F6 . D6 | . E6 . C6 . . . .`,
      },
      {
        wave: 'triangle', gain: 0.2,
        notes: `C3 - G3 - C3 - G3 - | F2 - C3 - F2 - C3 - | G2 - D3 - G2 - D3 - | C3 - G3 - C3 - G3 - |
                A2 - E3 - A2 - E3 - | F2 - C3 - F2 - C3 - | G2 - D3 - G2 - B2 - | C3 - G3 - C3 - . .`,
      },
    ],
  },
  // プレイ中: 元気に。レベルが上がるとテンポが上がる
  play: {
    bpm: 140,
    tracks: [
      {
        wave: 'square', gain: 0.07,
        notes: `G5 . G5 B5 D6 . B5 . | C6 . E6 . D6 C6 B5 . | A5 . F#5 A5 D6 . C6 . | B5 - G5 . D5 . . . |
                E5 . G5 B5 E6 . D6 . | C6 . B5 A5 G5 . E5 . | F#5 . A5 . D6 . C6 A5 | G5 - - . . . D5 F#5`,
      },
      {
        wave: 'triangle', gain: 0.22,
        notes: `G2 G3 G2 G3 G2 G3 G2 G3 | C3 C4 C3 C4 C3 C4 C3 C4 | D3 D4 D3 D4 D3 D4 D3 D4 | G2 G3 G2 G3 G2 G3 G2 G3 |
                E2 E3 E2 E3 E2 E3 E2 E3 | C3 C4 C3 C4 C3 C4 C3 C4 | D3 D4 D3 D4 D3 D4 D3 D4 | G2 G3 G2 G3 D3 D3 D3 D3`,
      },
      {
        drums: true, gain: 0.5,
        notes: `k h s h k h s h | k h s h k h s h | k h s h k h s h | k h s h k k s s |
                k h s h k h s h | k h s h k h s h | k h s h k h s h | k h s h k s s s`,
      },
    ],
  },
};

// レベル1で等倍、レベルが1つ上がるごとに6%ずつ速くなる（Lv6で1.3倍）
export function tempoScale(level) {
  return 1 + 0.06 * (Math.max(1, level) - 1);
}

const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

// "A4" → 440
export function noteFreq(name) {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  if (!m) throw new Error(`bad note: ${name}`);
  const midi = (Number(m[2]) + 1) * 12 + NOTE_INDEX[m[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}

// 楽譜の文字列を、1マスごとの { freq, len }（休み・のばしは null）または ドラム記号 の配列にする
export function parseTrack(text, drums = false) {
  const tokens = text.split(/\s+/).filter((t) => t && t !== '|');
  return tokens.map((t, i) => {
    if (t === '-' || t === '.') return null;
    if (drums) {
      if (!'ksh'.includes(t) || t.length !== 1) throw new Error(`bad drum: ${t}`);
      return t;
    }
    let len = 1;
    while (tokens[i + len] === '-') len++;
    return { freq: noteFreq(t), len };
  });
}

// 曲を鳴らす係。getAudio() で AudioContext をもらい、少し先までの音を予約し続ける
export function createMusic(getAudio) {
  const parsed = Object.fromEntries(
    Object.entries(SONGS).map(([id, song]) => [
      id,
      { bpm: song.bpm, tracks: song.tracks.map((tr) => ({ ...tr, steps: parseTrack(tr.notes, tr.drums) })) },
    ]),
  );
  let current = null; // { id, song, step, nextTime, master }
  let rate = 1;
  let muted = false;
  let timer = null;
  let noise = null;

  const VOLUME = 0.6;
  const AHEAD = 0.15; // 何秒先まで予約しておくか

  function stepDur(song) {
    return 60 / (song.bpm * rate) / 2; // 8分音符
  }

  function noiseBuffer(audio) {
    if (!noise) {
      noise = audio.createBuffer(1, audio.sampleRate * 0.3, audio.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noise;
  }

  function playNote(audio, out, tr, note, t, dur) {
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = tr.wave;
    osc.frequency.setValueAtTime(note.freq, t);
    const len = Math.max(0.05, note.len * dur * 0.92);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(tr.gain, t + 0.01);
    g.gain.setTargetAtTime(tr.gain * 0.6, t + 0.02, 0.08);
    g.gain.setTargetAtTime(0.0001, t + len - 0.03, 0.02);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + len + 0.1);
  }

  function playDrum(audio, out, tr, kind, t) {
    if (kind === 'k') {
      const osc = audio.createOscillator();
      const g = audio.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(tr.gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 0.15);
      return;
    }
    const src = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const g = audio.createGain();
    src.buffer = noiseBuffer(audio);
    filter.type = kind === 's' ? 'bandpass' : 'highpass';
    filter.frequency.value = kind === 's' ? 1800 : 7000;
    const len = kind === 's' ? 0.12 : 0.04;
    const gain = kind === 's' ? tr.gain * 0.5 : tr.gain * 0.25;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(filter).connect(g).connect(out);
    src.start(t);
    src.stop(t + len + 0.02);
  }

  function tick() {
    const audio = getAudio();
    if (!audio || !current) return;
    const { song } = current;
    // 裏に回っていて大きく遅れたら、まとめて鳴らさずに今から再開する
    if (current.nextTime < audio.currentTime - 0.3) current.nextTime = audio.currentTime + 0.05;
    while (current.nextTime < audio.currentTime + AHEAD) {
      const dur = stepDur(song);
      for (const tr of song.tracks) {
        const s = tr.steps[current.step];
        if (!s) continue;
        if (tr.drums) playDrum(audio, current.master, tr, s, current.nextTime);
        else playNote(audio, current.master, tr, s, current.nextTime, dur);
      }
      current.nextTime += dur;
      current.step = (current.step + 1) % song.tracks[0].steps.length;
    }
  }

  function stop() {
    if (!current) return;
    const audio = getAudio();
    const { master } = current;
    if (audio) {
      master.gain.setTargetAtTime(0, audio.currentTime, 0.05);
      setTimeout(() => master.disconnect(), 400);
    }
    current = null;
    clearInterval(timer);
    timer = null;
  }

  return {
    // 同じ曲が流れていれば何もしない（最初から鳴らし直さない）
    play(id) {
      const audio = getAudio();
      if (!audio) return;
      if (current?.id === id) return;
      stop();
      const master = audio.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(audio.destination);
      current = { id, song: parsed[id], step: 0, nextTime: audio.currentTime + 0.05, master };
      tick();
      timer = setInterval(tick, 25);
    },
    stop,
    setRate(r) {
      rate = r;
    },
    setMuted(m) {
      muted = m;
      const audio = getAudio();
      if (current && audio) current.master.gain.setTargetAtTime(m ? 0 : VOLUME, audio.currentTime, 0.03);
    },
    get playing() {
      return current?.id ?? null;
    },
  };
}
