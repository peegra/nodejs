import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, noteFreq, parseTrack, tempoScale } from '../src/music.js';

test('音の高さ: A4 は 440Hz、1オクターブ上で2倍', () => {
  assert.equal(noteFreq('A4'), 440);
  assert.ok(Math.abs(noteFreq('A5') - 880) < 1e-9);
  assert.ok(Math.abs(noteFreq('C4') - 261.63) < 0.01);
  assert.ok(noteFreq('F#5') > noteFreq('F5'));
});

test('楽譜: "-" でのばした分だけ音が長くなる', () => {
  const steps = parseTrack('C4 - - . E4 | G4');
  assert.equal(steps.length, 6);
  assert.equal(steps[0].len, 3);
  assert.equal(steps[1], null);
  assert.equal(steps[3], null);
  assert.equal(steps[4].len, 1);
});

test('どの曲も、全パートが同じ長さで、小節（8マス）で割り切れる', () => {
  for (const [id, song] of Object.entries(SONGS)) {
    const lengths = song.tracks.map((tr) => parseTrack(tr.notes, tr.drums).length);
    assert.ok(lengths.every((n) => n === lengths[0]), `${id}: ${lengths}`);
    assert.equal(lengths[0] % 8, 0, id);
  }
});

test('タイトル曲はゆっくり、プレイ中の曲は速い', () => {
  assert.ok(SONGS.title.bpm < 100);
  assert.ok(SONGS.play.bpm > SONGS.title.bpm);
});

test('レベルが上がるとテンポが少しずつ速くなる（Lv1 は等倍）', () => {
  assert.equal(tempoScale(1), 1);
  for (let lv = 2; lv <= 6; lv++) assert.ok(tempoScale(lv) > tempoScale(lv - 1));
  assert.ok(tempoScale(6) <= 1.35);
});
