// game-logic.js
// Modul logika murni (pure functions) dari game Sambung Kata
// Dipisahkan agar mudah di-unit test tanpa dependensi WebSocket/server

/**
 * Mengembalikan huruf terakhir dari sebuah kata (lowercase).
 * @param {string} word
 * @returns {string}
 */
function getLastChar(word) {
  if (!word) return '';
  return word.charAt(word.length - 1).toLowerCase();
}

/**
 * Mengecek apakah sebuah kata valid untuk digunakan dalam sambung kata.
 * @param {string} newWord    - Kata yang ingin diajukan pemain
 * @param {string} currentWord - Kata terakhir yang sudah dimainkan
 * @param {string[]} usedWords - Daftar kata yang sudah pernah dipakai
 * @returns {{ ok: boolean, reason?: string }}
 */
function isValidWord(newWord, currentWord, usedWords) {
  const w = (newWord || '').trim().toLowerCase();

  if (!w || w.length < 2) {
    return { ok: false, reason: 'Kata terlalu pendek (minimal 2 huruf).' };
  }

  if (isWordUsed(w, usedWords)) {
    return { ok: false, reason: `Kata "${w}" sudah pernah dipakai!` };
  }

  if (currentWord) {
    const lastChar = getLastChar(currentWord);
    if (w.charAt(0) !== lastChar) {
      return {
        ok: false,
        reason: `Kata harus diawali huruf "${lastChar.toUpperCase()}"!`,
      };
    }
  }

  return { ok: true };
}

/**
 * Menghitung poin untuk sebuah kata.
 * Base: 10 poin. Bonus: +2 per huruf di atas 4 huruf.
 * @param {string} word
 * @returns {number}
 */
function calculatePoints(word) {
  const len = (word || '').length;
  return 10 + Math.max(0, len - 4) * 2;
}

/**
 * Mengecek apakah sebuah kata sudah pernah digunakan.
 * @param {string} word
 * @param {string[]} usedWords
 * @returns {boolean}
 */
function isWordUsed(word, usedWords) {
  const w = (word || '').toLowerCase();
  return usedWords.map(u => u.toLowerCase()).includes(w);
}

module.exports = { getLastChar, isValidWord, calculatePoints, isWordUsed };
