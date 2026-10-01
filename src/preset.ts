import type { BuildingType } from './city.ts'
import { buildingAt, canPlace, emptyCity } from './city.ts'

export function romanPreset() {
  const city = emptyCity()
  function place(type: BuildingType, x: number, y: number, rotated = false) {
    if (type === 'road' && buildingAt(city, x, y)?.type === 'road') return
    const building = { type, x, y, rotated }
    if (!canPlace(city, building)) throw new Error(`Ungueltiger Preset-Bauplatz: ${type} (${x}, ${y})`)
    city.buildings.push(building)
  }
  for (const row of [8, 17, 26]) for (let column = 6; column <= 41; column++) place('road', column, row)
  for (const column of [8, 16, 23, 31, 39]) for (let row = 5; row <= 30; row++) place('road', column, row)
  for (let column = 5; column <= 38; column++) place('aqueduct', column, 4, true)
  place('forum', 25, 12)
  place('temple', 18, 12)
  place('square', 25, 9)
  place('market', 25, 19)
  place('baths', 18, 19)
  place('warehouse', 33, 19)
  place('warehouse', 35, 23)
  for (const column of [10, 13]) for (const row of [10, 13, 19, 23]) place(row === 23 ? 'insula' : 'house', column, row)
  for (const column of [33, 36]) for (const row of [10, 13, 28]) place(row === 28 ? 'insula' : 'house', column, row)
  for (const [column, row] of [[18, 23], [26, 23], [6, 28], [40, 28], [28, 28]]) place('garden', column, row)
  for (const [column, row] of [[21, 10], [29, 15], [21, 24], [38, 21], [37, 5]]) place('fountain', column, row)
  return city
}