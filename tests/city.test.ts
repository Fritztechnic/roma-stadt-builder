import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildingAt, buildingsInArea, canPlace, canReplaceBuildings, catalog, emptyCity, footprint, History, parseCity, replaceBuildings } from '../src/city.ts'
import { romanPreset } from '../src/preset.ts'
import { buildingAtScreen, buildingElevation, fitCamera, screenToTile, tileSize, tileToWorld } from '../src/render.ts'

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
    for (const [column, row] of [[0, 0], [city.width, 0], [0, city.height], [city.width, city.height]]) {
      const corner = tileToWorld(column, row)
      const screenX = camera.x + corner.x * camera.zoom
      const screenY = camera.y + corner.y * camera.zoom
      assert.ok(screenX >= 31 && screenX <= width - 31)
      assert.ok(screenY >= 63 && screenY <= height - 63)
    }
    assert.ok((city.width + city.height) * tileSize * camera.zoom <= width - 63)
    for (const [column, row] of [[0, 0], [6, 8], [47, 35], [-1, 3]]) {
      const point = tileToWorld(column + 0.5, row + 0.5)
      assert.deepEqual(screenToTile(camera, camera.x + point.x * camera.zoom, camera.y + point.y * camera.zoom), { x: column, y: row })
    }
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
  assert.equal(new Set(city.buildings.map(building => building.type)).size, catalog.length)
  assert.ok(city.buildings.length > 250)
  city.buildings.length = 0
  assert.ok(romanPreset().buildings.length > 250)
})

test('compact preset uses every tile and connects buildings to one street network', () => {
  const city = romanPreset()
  assert.equal(city.width, 48)
  assert.equal(city.height, 36)
  const tiles = new Map<string, typeof city.buildings[number]>()
  const paths = new Set<string>()
  for (const building of city.buildings) {
    const size = footprint(building)
    for (let row = building.y; row < building.y + size.height; row++) for (let column = building.x; column < building.x + size.width; column++) {
      const key = `${column},${row}`
      assert.equal(tiles.has(key), false, `overlapping tile ${key}`)
      tiles.set(key, building)
      if (['road', 'bridge', 'gate', 'square'].includes(building.type)) paths.add(key)
    }
  }
  assert.equal(tiles.size, city.width * city.height)
  assert.ok([...tiles.values()].filter(building => !['road', 'bridge', 'gate', 'square', 'wall', 'tower', 'moat'].includes(building.type)).length >= 750, 'too much circulation area instead of compact building plots')
  const connected = new Set<string>(['23,0'])
  const queue = ['23,0']
  for (const key of queue) {
    const [column, row] = key.split(',').map(Number)
    for (const [nextX, nextY] of [[column - 1, row], [column + 1, row], [column, row - 1], [column, row + 1]]) {
      const next = `${nextX},${nextY}`
      if (!paths.has(next) || connected.has(next)) continue
      connected.add(next)
      queue.push(next)
    }
  }
  assert.deepEqual([...paths].filter(key => !connected.has(key)), [], 'disconnected streets')
  for (const building of city.buildings) {
    if (['road', 'bridge', 'gate', 'square', 'wall', 'tower', 'moat', 'aqueduct', 'statue', 'fountain'].includes(building.type)) continue
    const size = footprint(building)
    const neighbors = []
    for (let offset = 0; offset < size.width; offset++) neighbors.push(`${building.x + offset},${building.y - 1}`, `${building.x + offset},${building.y + size.height}`)
    for (let offset = 0; offset < size.height; offset++) neighbors.push(`${building.x - 1},${building.y + offset}`, `${building.x + size.width},${building.y + offset}`)
    assert.ok(neighbors.some(key => connected.has(key)), `${building.type} at ${building.x},${building.y} has no street access`)
  }
})

test('isometric picking includes elevated roofs and walls in front-to-back order', () => {
  const city = emptyCity()
  city.buildings.push({ type: 'house', x: 5, y: 5, rotated: false }, { type: 'insula', x: 9, y: 5, rotated: true })
  const camera = { x: 180, y: 50, zoom: 1.2 }
  for (const building of city.buildings) {
    const size = footprint(building)
    const roof = tileToWorld(building.x + size.width / 2, building.y + size.height / 2)
    roof.y -= buildingElevation(building)
    assert.equal(buildingAtScreen(city, camera, camera.x + roof.x * camera.zoom, camera.y + roof.y * camera.zoom), building)
    const wall = tileToWorld(building.x + size.width - 0.1, building.y + size.height - 0.1)
    wall.y -= buildingElevation(building) / 2
    assert.equal(buildingAtScreen(city, camera, camera.x + wall.x * camera.zoom, camera.y + wall.y * camera.zoom), building)
  }
  assert.equal(buildingAtScreen(city, camera, -100, -100), undefined)
  const ridge = tileToWorld(6, 5)
  assert.equal(buildingAtScreen(city, camera, camera.x + ridge.x * camera.zoom, camera.y + (ridge.y - 36) * camera.zoom), city.buildings[0])
  const behind = { type: 'house', x: 5, y: 3, rotated: false } as const
  city.buildings.push(behind)
  const overlap = tileToWorld(6, 5)
  assert.equal(buildingAtScreen(city, camera, camera.x + overlap.x * camera.zoom, camera.y + (overlap.y - 10) * camera.zoom), city.buildings[0])
})

test('top-down view shares tile coordinates and picks footprints without elevation', () => {
  const city = emptyCity()
  city.buildings.push({ type: 'insula', x: 5, y: 8, rotated: true })
  const camera = { x: 0, y: 0, zoom: 1, view: 'topdown' } as const
  const fitted = { ...camera }
  fitCamera(fitted, city, 1050, 628)
  for (const [column, row] of [[0, 0], [47, 35], [-1, 3], [6, 9]]) {
    const point = tileToWorld(column + 0.5, row + 0.5, 'topdown')
    assert.deepEqual(screenToTile(fitted, fitted.x + point.x * fitted.zoom, fitted.y + point.y * fitted.zoom), { x: column, y: row })
  }
  assert.ok(fitted.x >= 31 && fitted.y >= 31)
  const point = tileToWorld(6, 9, 'topdown')
  assert.equal(buildingAtScreen(city, fitted, fitted.x + point.x * fitted.zoom, fitted.y + point.y * fitted.zoom), city.buildings[0])
  assert.equal(buildingAtScreen(city, fitted, 0, 0), undefined)
})

test('every catalog module supports rotation, saving and picking in both views', () => {
  assert.equal(catalog.length, 29)
  assert.equal(new Set(catalog.map(item => item.type)).size, catalog.length)
  for (const item of catalog) for (const rotated of [false, true]) {
    const city = emptyCity()
    const building = { type: item.type, x: 10, y: 10, rotated }
    assert.equal(canPlace(city, building), true, item.type)
    city.buildings.push(building)
    assert.deepEqual(parseCity(JSON.stringify(city)), city)
    assert.deepEqual(footprint(building), { width: rotated ? item.height : item.width, height: rotated ? item.width : item.height })
    assert.ok(Number.isFinite(buildingElevation(building)), item.type)
    for (const view of ['topdown', 'isometric'] as const) {
      const camera = { x: 100, y: 50, zoom: 1.25, view }
      const size = footprint(building)
      const point = tileToWorld(building.x + size.width / 2, building.y + size.height / 2, view)
      if (view === 'isometric') point.y -= buildingElevation(building)
      assert.equal(buildingAtScreen(city, camera, camera.x + point.x * camera.zoom, camera.y + point.y * camera.zoom), building, `${item.type}: ${view}`)
    }
  }
})

test('fields retain the saved farm type and new raised details are selectable', () => {
  assert.equal(catalog.find(item => item.type === 'farm')?.name, 'Feld')
  const city = emptyCity()
  city.buildings.push({ type: 'farm', x: 2, y: 2, rotated: false })
  assert.deepEqual(parseCity(JSON.stringify(city)), city)
  const camera = { x: 100, y: 50, zoom: 1.25, view: 'isometric' as const }
  for (const [type, extra] of [['wall', 6], ['tower', 6], ['gate', 10], ['statue', 24], ['bakery', 18]] as const) {
    const building = { type, x: 10, y: 10, rotated: false }
    const size = footprint(building)
    const point = tileToWorld(building.x + size.width / 2, building.y + size.height / 2)
    point.y -= buildingElevation(building) + extra - 1
    assert.equal(buildingAtScreen({ ...emptyCity(), buildings: [building] }, camera, camera.x + point.x * camera.zoom, camera.y + point.y * camera.zoom), building, type)
  }
})