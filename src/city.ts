export const catalog = [
  { type: 'road', name: 'Strasse', group: 'Infrastruktur', width: 1, height: 1, color: '#aaa99c', icon: 'Route' },
  { type: 'square', name: 'Platz', group: 'Infrastruktur', width: 2, height: 2, color: '#c3bda6', icon: 'Grid2X2' },
  { type: 'fountain', name: 'Brunnen', group: 'Infrastruktur', width: 1, height: 1, color: '#56a9b5', icon: 'Droplets' },
  { type: 'aqueduct', name: 'Aquaedukt', group: 'Infrastruktur', width: 1, height: 1, color: '#809ba0', icon: 'Waves' },
  { type: 'house', name: 'Wohnhaus', group: 'Wohnen', width: 2, height: 2, color: '#bd6654', icon: 'House' },
  { type: 'insula', name: 'Insula', group: 'Wohnen', width: 2, height: 3, color: '#a74e40', icon: 'Building2' },
  { type: 'forum', name: 'Forum', group: 'Oeffentlich', width: 4, height: 3, color: '#d6cba8', icon: 'Landmark' },
  { type: 'market', name: 'Markt', group: 'Oeffentlich', width: 3, height: 2, color: '#cb9b4c', icon: 'Store' },
  { type: 'temple', name: 'Tempel', group: 'Oeffentlich', width: 3, height: 3, color: '#e5dfce', icon: 'Landmark' },
  { type: 'baths', name: 'Therme', group: 'Oeffentlich', width: 3, height: 3, color: '#749da9', icon: 'Bath' },
  { type: 'warehouse', name: 'Lagerhaus', group: 'Wirtschaft', width: 3, height: 2, color: '#958978', icon: 'Warehouse' },
  { type: 'garden', name: 'Garten', group: 'Freiraum', width: 2, height: 2, color: '#518967', icon: 'Trees' },
] as const

export type BuildingType = typeof catalog[number]['type']
export type Building = { type: BuildingType; x: number; y: number; rotated: boolean }
export type City = { version: 1; width: number; height: number; buildings: Building[] }

export function emptyCity(): City {
  return { version: 1, width: 48, height: 36, buildings: [] }
}

export function definition(type: BuildingType) {
  return catalog.find(item => item.type === type)!
}

export function footprint(building: Building) {
  const item = definition(building.type)
  return building.rotated ? { width: item.height, height: item.width } : { width: item.width, height: item.height }
}

export function buildingAt(city: City, x: number, y: number) {
  return city.buildings.find(building => {
    const size = footprint(building)
    return x >= building.x && y >= building.y && x < building.x + size.width && y < building.y + size.height
  })
}

export function canPlace(city: City, building: Building): boolean {
  const size = footprint(building)
  if (!Number.isInteger(building.x) || !Number.isInteger(building.y) || building.x < 0 || building.y < 0 || building.x + size.width > city.width || building.y + size.height > city.height) return false
  return !city.buildings.some(other => {
    const otherSize = footprint(other)
    return building.x < other.x + otherSize.width && building.x + size.width > other.x && building.y < other.y + otherSize.height && building.y + size.height > other.y
  })
}

export function buildingsInArea(city: City, from: { x: number; y: number }, to: { x: number; y: number }) {
  const left = Math.min(from.x, to.x)
  const top = Math.min(from.y, to.y)
  const right = Math.max(from.x, to.x) + 1
  const bottom = Math.max(from.y, to.y) + 1
  return city.buildings.filter(building => {
    const size = footprint(building)
    return building.x < right && building.x + size.width > left && building.y < bottom && building.y + size.height > top
  })
}

export function canReplaceBuildings(city: City, originals: readonly Building[], replacements: readonly Building[]): boolean {
  if (originals.length !== replacements.length || !originals.every(building => city.buildings.includes(building))) return false
  const remaining = { ...city, buildings: city.buildings.filter(building => !originals.includes(building)) }
  for (const building of replacements) {
    if (!canPlace(remaining, building)) return false
    remaining.buildings.push(building)
  }
  return true
}

export function replaceBuildings(city: City, originals: readonly Building[], replacements: readonly Building[]): boolean {
  if (!canReplaceBuildings(city, originals, replacements)) return false
  const indices = originals.map(building => city.buildings.indexOf(building))
  indices.forEach((index, position) => { city.buildings[index] = replacements[position] })
  return true
}

export function parseCity(text: string): City {
  const data = JSON.parse(text)
  if (!data || data.version !== 1 || !Number.isInteger(data.width) || !Number.isInteger(data.height) || data.width < 8 || data.height < 8 || data.width > 128 || data.height > 128 || !Array.isArray(data.buildings) || data.buildings.length > data.width * data.height) throw new Error('Ungueltiges Stadtformat.')
  const city: City = { version: 1, width: data.width, height: data.height, buildings: [] }
  for (const item of data.buildings) {
    if (!item || !catalog.some(entry => entry.type === item.type) || typeof item.rotated !== 'boolean') throw new Error('Unbekanntes oder ungueltiges Gebaeude.')
    const building: Building = { type: item.type, x: item.x, y: item.y, rotated: item.rotated }
    if (!canPlace(city, building)) throw new Error('Gebaeude ueberlappen oder liegen ausserhalb der Karte.')
    city.buildings.push(building)
  }
  return city
}

export class History {
  private past: string[] = []
  private future: string[] = []
  get canUndo() { return this.past.length > 0 }
  get canRedo() { return this.future.length > 0 }
  record(before: string, city: City) {
    if (before === JSON.stringify(city)) return false
    this.past.push(before)
    if (this.past.length > 100) this.past.shift()
    this.future = []
    return true
  }
  undo(city: City): City {
    const previous = this.past.pop()
    if (!previous) return city
    this.future.push(JSON.stringify(city))
    return parseCity(previous)
  }
  redo(city: City): City {
    const next = this.future.pop()
    if (!next) return city
    this.past.push(JSON.stringify(city))
    return parseCity(next)
  }
}