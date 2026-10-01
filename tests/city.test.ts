import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildingAt, buildingsInArea, canPlace, canReplaceBuildings, emptyCity, footprint, History, parseCity, replaceBuildings } from '../src/city.ts'
import { romanPreset } from '../src/preset.ts'
import { fitCamera, screenToTile, tileSize } from '../src/render.ts'

test('footprints, boundaries and collisions', () => {
  const city = emptyCity()
  const house = { type: 'house', x: 2, y: 2, rotated: false } as const
  assert.equal(canPlace(city, house), true)
  city.buildings.push(house)
  assert.equal(canPlace(city, { ...house, x: 3 }), false)
  assert.equal(canPlace(city, { ...house, x: 4 }), true)
  assert.equal(canPlace(city, { ...house, x: -1 }), false)
  assert.equal(canPlace(city, { ...house, x: 47 }), false)
  assert.equal(canPlace(city, { ...house, y: 35 }), false)
  assert.equal(canPlace(city, { ...house, x: 1.5 }), false)
  assert.equal(buildingAt(city, 3, 3), house)
  assert.equal(buildingAt(city, 4, 3), undefined)
  assert.deepEqual(footprint({ type: 'insula', x: 0, y: 0, rotated: true }), { width: 3, height: 2 })
})

test('save round trip and reject invalid imports', () => {
  const city = emptyCity()
  city.buildings.push({ type: 'temple', x: 0, y: 0, rotated: false })
  assert.deepEqual(parseCity(JSON.stringify(city)), city)
  for (const data of [null, { ...city, version: 2 }, { ...city, width: 999 }, { ...city, buildings: [{ type: 'unknown', x: 0, y: 0, rotated: false }] }, { ...city, buildings: [...city.buildings, ...city.buildings] }, { ...city, buildings: [{ ...city.buildings[0], x: 48 }] }]) {
    assert.throws(() => parseCity(JSON.stringify(data)))
  }
})

test('a drag is one undo step, redo is cleared by a new edit', () => {
  let city = emptyCity()
  const history = new History()
  const before = JSON.stringify(city)
  city.buildings.push({ type: 'road', x: 0, y: 0, rotated: false }, { type: 'road', x: 1, y: 0, rotated: false })
  assert.equal(history.record(before, city), true)
  city = history.undo(city)
  assert.equal(city.buildings.length, 0)
  city = history.redo(city)
  assert.equal(city.buildings.length, 2)
  city = history.undo(city)
  const next = JSON.stringify(city)
  city.buildings.push({ type: 'garden', x: 5, y: 5, rotated: false })
  history.record(next, city)
  assert.equal(history.canRedo, false)
  assert.equal(history.record(JSON.stringify(city), city), false)
})

test('camera fit and coordinate conversion on desktop sizes', () => {
  for (const [width, height] of [[1050, 628], [1690, 988]]) {
    const city = emptyCity()
    const camera = { x: 0, y: 0, zoom: 1 }
    fitCamera(camera, city, width, height)
    assert.ok(camera.x >= 31 && camera.y >= 31)
    assert.ok(city.width * tileSize * camera.zoom <= width - 63)
    assert.deepEqual(screenToTile(camera, camera.x + 6.5 * tileSize * camera.zoom, camera.y + 8.5 * tileSize * camera.zoom), { x: 6, y: 8 })
    assert.equal(screenToTile(camera, camera.x - 1, camera.y).x, -1)
  }
})

test('group moves exclude old footprints and reject all invalid changes atomically', () => {
  const city = emptyCity()
  city.buildings.push({ type: 'house', x: 2, y: 2, rotated: false }, { type: 'insula', x: 4, y: 2, rotated: false }, { type: 'temple', x: 10, y: 2, rotated: false })
  const originals = city.buildings.slice(0, 2)
  const moved = originals.map(building => ({ ...building, x: building.x + 2 }))
  assert.equal(canReplaceBuildings(city, originals, moved), true)
  assert.equal(replaceBuildings(city, originals, moved), true)
  const before = JSON.stringify(city)
  const selection = city.buildings.slice(0, 2)
  assert.equal(replaceBuildings(city, selection, selection.map(building => ({ ...building, x: building.x + 4 }))), false)
  assert.equal(replaceBuildings(city, selection, selection.map(building => ({ ...building, x: -1 }))), false)
  assert.equal(replaceBuildings(city, selection, selection.map(building => ({ ...building, x: 0, y: 0 }))), false)
  assert.equal(JSON.stringify(city), before)
  assert.deepEqual(buildingsInArea(city, { x: 7, y: 4 }, { x: 5, y: 3 }), selection)
})

test('rotation is rejected when its new footprint collides', () => {
  const city = emptyCity()
  city.buildings.push({ type: 'insula', x: 2, y: 2, rotated: false }, { type: 'road', x: 4, y: 2, rotated: false })
  const original = city.buildings[0]
  assert.equal(replaceBuildings(city, [original], [{ ...original, rotated: true }]), false)
  city.buildings.pop()
  assert.equal(replaceBuildings(city, [original], [{ ...original, rotated: true }]), true)
  assert.equal(city.buildings[0].rotated, true)
})

test('Roman preset is valid, complete and returns independent cities', () => {
  const city = romanPreset()
  assert.deepEqual(parseCity(JSON.stringify(city)), city)
  assert.equal(new Set(city.buildings.map(building => building.type)).size, 12)
  assert.ok(city.buildings.length > 250)
  city.buildings.length = 0
  assert.ok(romanPreset().buildings.length > 250)
})