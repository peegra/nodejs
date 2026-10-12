import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// 前回見た在庫状態を JSON ファイルに保存する。試作なのでDBは使わない。
export function loadState(file) {
  if (!existsSync(file)) return { watches: {} };
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function saveState(file, state) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, file); // 書き込み途中で落ちても壊れないように差し替える
}
