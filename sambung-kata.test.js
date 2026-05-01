// sambung-kata.test.js
// Unit Testing untuk logika game Sambung Kata
// Menggunakan Jest sebagai testing framework
// Dibuat dengan bantuan AI (Claude)

// ── Import fungsi yang diuji ──────────────────────────────
const {
  getLastChar,
  isValidWord,
  calculatePoints,
  isWordUsed,
} = require("./game-logic");

// ─────────────────────────────────────────────────────────
// getLastChar
// ─────────────────────────────────────────────────────────
describe("getLastChar()", () => {
  test("mengembalikan huruf terakhir dari kata biasa", () => {
    expect(getLastChar("makan")).toBe("n");
  });

  test("tidak case-sensitive (huruf kapital → lowercase)", () => {
    expect(getLastChar("APEL")).toBe("l");
  });

  test("mengembalikan karakter tunggal jika hanya satu huruf", () => {
    expect(getLastChar("a")).toBe("a");
  });

  test("mengembalikan string kosong jika input kosong", () => {
    expect(getLastChar("")).toBe("");
  });
});

// ─────────────────────────────────────────────────────────
// isValidWord
// ─────────────────────────────────────────────────────────
describe("isValidWord()", () => {
  const usedWords = ["makan", "nasi", "ikan"];

  test("menerima kata yang benar diawali huruf yang tepat", () => {
    const result = isValidWord("nanas", "nasi", usedWords);
    expect(result.ok).toBe(true);
  });

  test("menolak kata yang tidak diawali huruf terakhir kata sebelumnya", () => {
    const result = isValidWord("apel", "nasi", usedWords);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/huruf/i);
  });

  test("menolak kata yang sudah pernah dipakai", () => {
    const result = isValidWord("ikan", "nasi", usedWords);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/sudah/i);
  });

  test("menolak kata yang terlalu pendek (kurang dari 2 huruf)", () => {
    const result = isValidWord("i", "nasi", usedWords);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/pendek/i);
  });

  test("menolak string kosong", () => {
    const result = isValidWord("", "nasi", usedWords);
    expect(result.ok).toBe(false);
  });

  test("menerima kata pertama (currentWord kosong) apa pun awalannya", () => {
    const result = isValidWord("meja", "", []);
    expect(result.ok).toBe(true);
  });

  test('tidak case-sensitive — "NANAS" dianggap sama dengan "nanas"', () => {
    const result = isValidWord("NANAS", "nasi", ["nanas"]);
    expect(result.ok).toBe(false); // sudah pernah dipakai
  });

  test("menerima kata dengan panjang tepat 2 huruf", () => {
    const result = isValidWord("ia", "nasi", usedWords);
    expect(result.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────
// calculatePoints
// ─────────────────────────────────────────────────────────
describe("calculatePoints()", () => {
  test("kata 4 huruf atau kurang mendapat 10 poin", () => {
    expect(calculatePoints("nasi")).toBe(10);
    expect(calculatePoints("api")).toBe(10);
    expect(calculatePoints("ia")).toBe(10);
  });

  test("kata 5 huruf mendapat 12 poin (10 + 1*2)", () => {
    expect(calculatePoints("nanas")).toBe(12);
  });

  test("kata 8 huruf mendapat 18 poin (10 + 4*2)", () => {
    expect(calculatePoints("komputer")).toBe(18);
  });

  test("kata 10 huruf mendapat 22 poin (10 + 6*2)", () => {
    expect(calculatePoints("perjalanan")).toBe(22);
  });

  test("mengembalikan 10 untuk string kosong (batas bawah aman)", () => {
    expect(calculatePoints("")).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────
// isWordUsed
// ─────────────────────────────────────────────────────────
describe("isWordUsed()", () => {
  const used = ["makan", "nasi", "ikan"];

  test("mengembalikan true jika kata sudah dipakai", () => {
    expect(isWordUsed("nasi", used)).toBe(true);
  });

  test("mengembalikan false jika kata belum dipakai", () => {
    expect(isWordUsed("nanas", used)).toBe(false);
  });

  test('case-insensitive — "NASI" dideteksi sebagai sudah dipakai', () => {
    expect(isWordUsed("NASI", used)).toBe(true);
  });

  test("mengembalikan false untuk array kosong", () => {
    expect(isWordUsed("nasi", [])).toBe(false);
  });
});
