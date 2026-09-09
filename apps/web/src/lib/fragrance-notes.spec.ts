import assert from "node:assert/strict";
import test from "node:test";
import { familyColors, FRAGRANCE_FAMILIES } from "./fragrance-families";
import { FRAGRANCE_NOTES } from "./fragrance-notes";
import { PT_SLOTS, tablePosition } from "./fragrance-pt-slots";

test("authors 118 notes with unique 2-letter symbols", () => {
  assert.equal(FRAGRANCE_NOTES.length, 118);
  assert.equal(PT_SLOTS.length, 118);
  const symbols = FRAGRANCE_NOTES.map((n) => n.symbol);
  assert.equal(new Set(symbols).size, 118);
  const codes = FRAGRANCE_NOTES.map((n) => n.code);
  assert.equal(new Set(codes).size, 118);
  for (const note of FRAGRANCE_NOTES) {
    assert.equal(note.symbol.length, 2);
    assert.match(note.symbol, /^[A-Z][a-z]$/);
    assert.ok(FRAGRANCE_FAMILIES.includes(note.family));
    assert.ok(note.family in familyColors);
  }
});

test("every family has a premium color", () => {
  for (const family of FRAGRANCE_FAMILIES) {
    assert.match(familyColors[family], /^#[0-9a-fA-F]{6}$/);
  }
});

test("notes occupy the official periodic-table coordinates", () => {
  for (let i = 0; i < PT_SLOTS.length; i++) {
    const [column, row] = PT_SLOTS[i]!;
    const note = FRAGRANCE_NOTES[i]!;
    assert.equal(note.column, column, `${note.name} column`);
    assert.equal(note.row, row, `${note.name} row`);
  }
});

test("TABLE geometry matches the CSS3D periodic table example", () => {
  assert.deepEqual(tablePosition(1, 1), { x: -1190, y: 810 });
  assert.deepEqual(tablePosition(18, 1), { x: 1190, y: 810 });
  assert.deepEqual(tablePosition(4, 9), { x: -770, y: -630 });
  assert.deepEqual(tablePosition(4, 10), { x: -770, y: -810 });
});

test("compatible notes refer to other notes in the table", () => {
  const names = new Set(FRAGRANCE_NOTES.map((n) => n.name));
  for (const note of FRAGRANCE_NOTES) {
    for (const other of note.compatibleWith ?? []) {
      assert.ok(names.has(other), `${note.name} lists unknown blend ${other}`);
    }
  }
});

test("sphere helix and grid formulas yield 118 finite distinct positions", () => {
  const count = 118;
  const sphere = new Set<string>();
  const helix = new Set<string>();
  const grid = new Set<string>();
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    const sx = 800 * Math.sin(phi) * Math.sin(theta);
    const sy = 800 * Math.cos(phi);
    const sz = 800 * Math.sin(phi) * Math.cos(theta);
    assert.ok([sx, sy, sz].every(Number.isFinite));
    sphere.add(`${sx.toFixed(5)},${sy.toFixed(5)},${sz.toFixed(5)}`);

    const ht = i * 0.175 + Math.PI;
    const hy = -(i * 8) + 450;
    const hx = 900 * Math.sin(ht);
    const hz = 900 * Math.cos(ht);
    assert.ok([hx, hy, hz].every(Number.isFinite));
    helix.add(`${hx.toFixed(5)},${hy.toFixed(5)},${hz.toFixed(5)}`);

    const gx = (i % 5) * 400 - 800;
    const gy = -(Math.floor(i / 5) % 5) * 400 + 800;
    const gz = Math.floor(i / 25) * 1000 - 2000;
    grid.add(`${gx},${gy},${gz}`);
  }
  assert.equal(sphere.size, count);
  assert.equal(helix.size, count);
  assert.equal(grid.size, count);
});
