import type { BuildingType } from './city.ts'
import { buildingAt, canPlace, emptyCity, footprint } from './city.ts'

export function romanPreset() {
  const city = { ...emptyCity(), width: 48, height: 36 }
  function place(type: BuildingType, x: number, y: number, rotated = false) {
    if (type === 'road' && ['road', 'bridge'].includes(buildingAt(city, x, y)?.type ?? '')) return
    const building = { type, x, y, rotated }
    if (!canPlace(city, building)) throw new Error(`Ungueltiger Preset-Bauplatz: ${type} (${x}, ${y})`)
    city.buildings.push(building)
  }
  for (const row of [0, 35]) for (let column = 0; column < city.width; column++) place(column >= 22 && column <= 24 ? 'road' : 'moat', column, row, true)
  for (const column of [0, 47]) for (let row = 1; row < city.height - 1; row++) place(row >= 15 && row <= 17 ? 'road' : 'moat', column, row)
  for (const row of [1, 34]) for (let column = 1; column <= 46; column++) {
    if (column === 22) place('gate', column, row)
    else if (column < 22 || column > 24) place([1, 9, 16, 30, 37, 46].includes(column) ? 'tower' : 'wall', column, row)
  }
  for (const column of [1, 46]) for (let row = 2; row <= 33; row++) {
    if (row === 15) place('gate', column, row, true)
    else if (row < 15 || row > 17) place([9, 25].includes(row) ? 'tower' : 'wall', column, row, true)
  }
  const crossings = [9, 16, 23, 30, 37]
  for (const column of crossings) place('bridge', column, 16)
  for (let column = 3; column <= 44; column++) if (!crossings.includes(column)) place('moat', column, 17, true)
  for (const row of [2, 9, 16, 18, 25, 33]) for (let column = 2; column <= 45; column++) place('road', column, row)
  for (const column of [2, 9, 16, 23, 30, 37, 45]) for (let row = 2; row <= 33; row++) place('road', column, row)

  place('amphitheater', 3, 3)
  place('theater', 3, 10)
  place('forum', 17, 10)
  place('basilica', 17, 14)
  place('library', 24, 10)
  place('school', 28, 10)
  place('temple', 24, 13)
  place('square', 28, 13)
  place('statue', 28, 12)
  place('fountain', 29, 12)
  for (const row of [3, 6, 10, 13]) place('villa', 31, row)
  place('reservoir', 38, 3)
  place('warehouse', 38, 6)
  for (let row = 3; row <= 8; row++) place('aqueduct', 43, row)

  place('farm', 3, 19)
  place('orchard', 3, 22)
  place('warehouse', 10, 19)
  place('workshop', 14, 19)
  place('bakery', 10, 22)
  place('school', 13, 22)
  place('baths', 17, 19)
  place('library', 17, 23)
  place('market', 21, 19, true)
  place('bakery', 21, 23)
  place('forum', 24, 19)
  place('temple', 24, 22)
  place('garden', 28, 22)
  place('statue', 28, 19)
  place('fountain', 29, 24)
  place('theater', 31, 19)
  place('garden', 35, 19)
  place('bakery', 31, 23)
  place('workshop', 34, 23)
  place('baths', 38, 19)
  place('villa', 38, 22)
  place('orchard', 42, 19)
  place('house', 42, 23)
  for (const row of [26, 30]) {
    place('farm', 3, row)
    place('orchard', 10, row)
  }

  for (const [column, top, bottom] of [[21, 10, 15], [27, 10, 15], [34, 3, 15], [41, 3, 8], [42, 3, 8], [20, 19, 24]]) {
    for (let row = top; row <= bottom; row++) place('road', column, row)
  }
  for (let column = 17; column <= 22; column++) place('road', column, 13)
  for (let column = 10; column <= 15; column++) place('road', column, 21)
  for (let column = 3; column <= 8; column++) place('road', column, 29)

  for (let row = 3; row <= 32; row++) for (let column = 3; column <= 44; column++) {
    if (buildingAt(city, column, row)) continue
    const types: BuildingType[] = row >= 19 && column >= 10 && column <= 15 ? ['warehouse', 'workshop', 'bakery', 'house'] : ['insula', 'house', 'garden']
    let freeWidth = 0
    while (column + freeWidth <= 44 && !buildingAt(city, column + freeWidth, row)) freeWidth++
    let filled = false
    for (const type of types) {
      for (const rotated of type === 'insula' && freeWidth % 2 === 0 ? [false, true] : [true, false]) {
        const building = { type, x: column, y: row, rotated }
        if (!canPlace(city, building)) continue
        const size = footprint(building)
        const neighbors = []
        for (let offset = 0; offset < size.width; offset++) neighbors.push(buildingAt(city, column + offset, row - 1), buildingAt(city, column + offset, row + size.height))
        for (let offset = 0; offset < size.height; offset++) neighbors.push(buildingAt(city, column - 1, row + offset), buildingAt(city, column + size.width, row + offset))
        if (!neighbors.some(neighbor => neighbor?.type === 'road')) continue
        place(type, column, row, rotated)
        filled = true
        break
      }
      if (filled) break
    }
    if (!filled) {
      const neighbors = [buildingAt(city, column - 1, row), buildingAt(city, column + 1, row), buildingAt(city, column, row - 1), buildingAt(city, column, row + 1)]
      const connected = neighbors.some(neighbor => ['road', 'bridge', 'square'].includes(neighbor?.type ?? ''))
      place(connected ? 'road' : (column + row) % 2 ? 'fountain' : 'statue', column, row)
    }
  }
  return city
}