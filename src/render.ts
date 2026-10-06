import type { Building, City } from './city.ts';
import { buildingAt, canPlace, definition, footprint } from './city.ts';

export type ViewMode = 'topdown' | 'isometric'
export type Camera = { x: number; y: number; zoom: number; view?: ViewMode }
export const tileSize = 32
export function tileToWorld(x: number, y: number, view: ViewMode = 'isometric') {
  if (view === 'topdown') return { x: x * tileSize, y: y * tileSize }
  return { x: (x - y) * tileSize, y: (x + y) * tileSize / 2 }
}
export function screenToTile(camera: Camera, x: number, y: number) {
  const worldX = (x - camera.x) / camera.zoom
  const worldY = (y - camera.y) / camera.zoom
  if (camera.view === 'topdown') return { x: Math.floor(worldX / tileSize), y: Math.floor(worldY / tileSize) }
  return { x: Math.floor(worldX / (2 * tileSize) + worldY / tileSize), y: Math.floor(worldY / tileSize - worldX / (2 * tileSize)) }
}
export function fitCamera(camera: Camera, city: City, width: number, height: number) {
  if (camera.view === 'topdown') {
    camera.zoom = Math.min(1.5, (width - 64) / (city.width * tileSize), (height - 64) / (city.height * tileSize))
    camera.x = (width - city.width * tileSize * camera.zoom) / 2
    camera.y = (height - city.height * tileSize * camera.zoom) / 2
    return
  }
  const mapWidth = (city.width + city.height) * tileSize
  const mapHeight = mapWidth / 2
  camera.zoom = Math.min(1.5, (width - 64) / mapWidth, (height - 128) / mapHeight)
  camera.x = (width - mapWidth * camera.zoom) / 2 + city.height * tileSize * camera.zoom
  camera.y = 64 + (height - 128 - mapHeight * camera.zoom) / 2
}
export function buildingElevation(building: Building) {
  const heights = { road: 0, square: 0, garden: 0, fountain: 5, aqueduct: 30, house: 24, insula: 44, forum: 12, market: 12, temple: 30, baths: 18, warehouse: 22, wall: 24, gate: 34, tower: 48, bridge: 8, reservoir: 10, villa: 22, basilica: 30, school: 18, library: 26, theater: 14, amphitheater: 22, bakery: 18, workshop: 20, farm: 0, orchard: 0, statue: 14, moat: 0 }
  return heights[building.type]
}

function roofRise(building: Building) {
  return ({ house: 12, insula: 14, warehouse: 10, temple: 16, basilica: 14, library: 12, school: 10, bakery: 10, workshop: 10 } as Partial<Record<Building['type'], number>>)[building.type] ?? 0
}

const orderCache = new WeakMap<readonly Building[], { snapshot: (Building & { source: Building })[]; ordered: Building[] }>()

function drawOrder(buildings: readonly Building[]) {
  const cached = orderCache.get(buildings)
  if (cached && cached.snapshot.length === buildings.length && cached.snapshot.every((previous, index) => {
    const building = buildings[index]
    return previous.source === building && previous.type === building.type && previous.x === building.x && previous.y === building.y && previous.rotated === building.rotated
  })) return cached.ordered
  const ordered = [...buildings].sort((first, second) => {
    const firstSize = footprint(first)
    const secondSize = footprint(second)
    return first.x + first.y + firstSize.width + firstSize.height - second.x - second.y - secondSize.width - secondSize.height
  })
  orderCache.set(buildings, { snapshot: buildings.map(building => ({ ...building, source: building })), ordered })
  return ordered
}

function buildingCorners(building: Building) {
  const size = footprint(building)
  return [tileToWorld(building.x, building.y), tileToWorld(building.x + size.width, building.y), tileToWorld(building.x + size.width, building.y + size.height), tileToWorld(building.x, building.y + size.height)]
}

export function buildingAtScreen(city: City, camera: Camera, x: number, y: number) {
  if (camera.view === 'topdown') {
    const tile = screenToTile(camera, x, y)
    return buildingAt(city, tile.x, tile.y)
  }
  const point = { x: (x - camera.x) / camera.zoom, y: (y - camera.y) / camera.zoom }
  const ordered = drawOrder(city.buildings)
  for (let index = ordered.length - 1; index >= 0; index--) {
    const building = ordered[index]
    const details = ({ wall: 6, tower: 6, gate: 10, statue: 24, villa: 6, bridge: 4, bakery: 18, theater: 7 } as Partial<Record<Building['type'], number>>)[building.type] ?? 0
    const elevation = buildingElevation(building) + Math.max(roofRise(building), details)
    const [back, right, front, left] = buildingCorners(building)
    if (point.x < left.x || point.x > right.x || point.y < back.y - elevation || point.y > front.y) continue
    const polygon = [{ x: back.x, y: back.y - elevation }, { x: right.x, y: right.y - elevation }, right, front, left, { x: left.x, y: left.y - elevation }]
    let positive = false
    let negative = false
    for (let index = 0; index < polygon.length; index++) {
      const start = polygon[index]
      const end = polygon[(index + 1) % polygon.length]
      const cross = (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x)
      if (cross > 0.0001) positive = true
      if (cross < -0.0001) negative = true
    }
    if (!(positive && negative)) return building
  }
}

function polygon(context: CanvasRenderingContext2D, points: { x: number; y: number }[], color: string) {
  context.fillStyle = color
  context.beginPath()
  points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y))
  context.closePath()
  context.fill()
  context.stroke()
}

function modelPoint(building: Building, x: number, y: number, elevation = 0) {
  const point = tileToWorld(building.x + (building.rotated ? definition(building.type).height - y : x), building.y + (building.rotated ? x : y))
  point.y -= elevation
  return point
}

function drawBlock(context: CanvasRenderingContext2D, building: Building, area: [number, number, number, number], bottom: number, top: number, color = '#e4d9bd', roof = false) {
  const [x, y, width, height] = area
  const corners = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]].map(([column, row]) => modelPoint(building, column!, row!, top))
  const [back, right, front, left] = building.rotated ? [corners[3], corners[0], corners[1], corners[2]] : corners
  const base = (point: { x: number; y: number }) => ({ x: point.x, y: point.y + top - bottom })
  context.strokeStyle = '#827961'
  context.lineWidth = 0.55
  polygon(context, [left!, front!, base(front!), base(left!)], '#d2c5a8')
  polygon(context, [front!, right!, base(right!), base(front!)], '#a3977e')
  if (!roof) { polygon(context, [back!, right!, front!, left!], color); return }
  const ridgeStart = modelPoint(building, width > height ? x : x + width / 2, width > height ? y + height / 2 : y, top + 6)
  const ridgeEnd = modelPoint(building, width > height ? x + width : x + width / 2, width > height ? y + height / 2 : y + height, top + 6)
  const [first, second, third, fourth] = corners
  const planes = width > height ? [[first!, second!, ridgeEnd, ridgeStart], [ridgeStart, ridgeEnd, third!, fourth!]] : [[first!, ridgeStart, ridgeEnd, fourth!], [ridgeStart, second!, third!, ridgeEnd]]
  planes.forEach((points, index) => {
    polygon(context, points, index ? '#a95e47' : '#cc8060')
    for (let tile = 1; tile < 6; tile++) {
      const fraction = tile / 6
      context.beginPath()
      context.moveTo(points[0].x + (points[1].x - points[0].x) * fraction, points[0].y + (points[1].y - points[0].y) * fraction)
      context.lineTo(points[3].x + (points[2].x - points[3].x) * fraction, points[3].y + (points[2].y - points[3].y) * fraction)
      context.stroke()
    }
  })
}

function drawVenue(context: CanvasRenderingContext2D, building: Building) {
  const item = definition(building.type)
  const elevation = buildingElevation(building)
  const theater = building.type === 'theater'
  const centerX = item.width / 2
  const centerY = item.height * (theater ? 0.43 : 0.5)
  const segments = theater ? 24 : 48
  const span = theater ? Math.PI : Math.PI * 2
  const at = (angle: number, inset: number, height: number) => modelPoint(building, centerX + (item.width * 0.46 - inset) * Math.cos(angle), centerY + (item.height * 0.44 - inset) * Math.sin(angle), height)
  const angles = Array.from({ length: segments }, (_, index) => [index * span / segments, (index + 1) * span / segments] as const)
  angles.sort((first, second) => at((first[0] + first[1]) / 2, 0, 0).y - at((second[0] + second[1]) / 2, 0, 0).y)
  context.lineWidth = 0.6
  context.strokeStyle = '#a09375'
  for (const [start, end] of angles) {
    const middle = (start + end) / 2
    polygon(context, [at(start, 0, 0), at(end, 0, 0), at(end, 0, elevation), at(start, 0, elevation)], Math.cos(middle) > 0 ? '#bdaf91' : '#ded1b1')
    const left = start + (end - start) * 0.22
    const right = end - (end - start) * 0.22
    const opening = [at(left, 0, 2), at(right, 0, 2), at(right, 0, elevation * 0.62), at(left, 0, elevation * 0.62)]
    context.fillStyle = '#726f60'
    context.beginPath()
    context.moveTo(opening[0].x, opening[0].y)
    context.lineTo(opening[1].x, opening[1].y)
    context.lineTo(opening[2].x, opening[2].y)
    const crown = at(middle, 0, elevation * 0.92)
    context.quadraticCurveTo(crown.x, crown.y, opening[3].x, opening[3].y)
    context.closePath()
    context.fill()
  }
  const floor = Array.from({ length: segments + 1 }, (_, index) => at(index * span / segments, 0.74, 2))
  polygon(context, floor, '#d9b878')
  const terraces = []
  for (let tier = 0; tier < 4; tier++) for (const [start, end] of angles) {
    const outer = tier * 0.18
    const inner = (tier + 1) * 0.18
    const top = elevation * (1 - tier / 5)
    const lower = elevation * (1 - (tier + 1) / 5)
    terraces.push({ depth: at((start + end) / 2, outer, 0).y, points: [at(start, outer, top), at(end, outer, top), at(end, inner, lower), at(start, inner, lower)], color: tier % 2 ? '#c8b994' : '#eee1bf' })
  }
  for (const terrace of terraces.sort((first, second) => first.depth - second.depth)) polygon(context, terrace.points, terrace.color)
  if (theater) {
    drawBlock(context, building, [0.2, centerY - 0.45, item.width - 0.4, 0.4], 0, elevation, '#be7e60')
    for (let column = 0.35; column < item.width - 0.3; column += 0.4) drawBlock(context, building, [column, centerY - 0.5, 0.1, 0.1], elevation, elevation + 7)
  }
}

function drawFacade(context: CanvasRenderingContext2D, building: Building, start: { x: number; y: number }, end: { x: number; y: number }, color: string) {
  const elevation = buildingElevation(building)
  const at = (fraction: number, height: number) => ({ x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction - height })
  const rectangle = (left: number, right: number, bottom: number, top: number, fill: string) => polygon(context, [at(left, bottom), at(right, bottom), at(right, top), at(left, top)], fill)
  context.strokeStyle = '#706e5c'
  context.lineWidth = 0.6
  if (building.type === 'aqueduct' || ((building.type === 'gate' || building.type === 'bridge') && Math.abs(end.x - start.x) > tileSize * 1.5)) {
    context.beginPath()
    const outline = [at(0, 0), at(1, 0), at(1, elevation), at(0, elevation)]
    outline.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y))
    context.closePath()
    const leftBase = at(0.2, 0)
    const leftSpring = at(0.2, elevation * 0.42)
    const crown = at(0.5, elevation - 3)
    const rightSpring = at(0.8, elevation * 0.42)
    const rightBase = at(0.8, 0)
    context.moveTo(leftBase.x, leftBase.y)
    context.lineTo(leftSpring.x, leftSpring.y)
    context.quadraticCurveTo(crown.x, crown.y, rightSpring.x, rightSpring.y)
    context.lineTo(rightBase.x, rightBase.y)
    context.closePath()
    context.fillStyle = color
    context.fill('evenodd')
    context.stroke()
    rectangle(0, 1, elevation - 5, elevation - 3, '#e1d8b9')
    return
  }
  const colonnade = ['temple', 'forum', 'basilica', 'library', 'amphitheater', 'theater'].includes(building.type)
  rectangle(0, 1, 0, elevation, colonnade ? '#8b826e' : color)
  const count = Math.max(2, Math.round(Math.abs(end.x - start.x) / tileSize) * 2)
  if (colonnade) {
    for (let index = 0; index < count; index++) {
      const fraction = (index + 0.5) / count
      const half = 0.17 / count
      rectangle(fraction - half, fraction + half, 2, elevation - 2, '#f0e6cf')
      rectangle(fraction - half * 1.5, fraction + half * 1.5, elevation - 4, elevation - 1, '#faf0da')
      rectangle(fraction - half * 1.5, fraction + half * 1.5, 1, 3, '#d1c5a5')
    }
  } else if (elevation >= 18 && building.type !== 'wall' && building.type !== 'tower') {
    const levels = building.type === 'insula' ? 3 : 1
    for (let level = 0; level < levels; level++) {
      const bottom = 8 + level * 11
      for (let index = 0; index < count; index++) {
        const fraction = (index + 0.5) / count
        rectangle(fraction - 0.13 / count, fraction + 0.13 / count, bottom, bottom + 6, '#495553')
        rectangle(fraction - 0.16 / count, fraction + 0.16 / count, bottom - 1, bottom, '#efe0bb')
      }
    }
    rectangle(building.type === 'warehouse' || building.type === 'workshop' ? 0.3 : 0.45, building.type === 'warehouse' || building.type === 'workshop' ? 0.7 : 0.55, 0, 10, '#806047')
    for (let level = 1; level < levels; level++) rectangle(0, 1, level * 11 + 3, level * 11 + 4, '#bb9f7e')
  }
  rectangle(0, 1, 0, 2, '#aaa48a')
  rectangle(0, 1, elevation - 2, elevation, '#e9dbb8')
  if (building.type === 'wall' || building.type === 'tower' || building.type === 'gate') {
    context.strokeStyle = '#9f957b'
    for (let height = 6; height < elevation - 2; height += 6) {
      const left = at(0, height)
      const right = at(1, height)
      context.beginPath()
      context.moveTo(left.x, left.y)
      context.lineTo(right.x, right.y)
      for (let column = (height % 12 ? 0.125 : 0.25); column < 1; column += 0.25) {
        const upper = at(column, height)
        const lower = at(column, height - 6)
        context.moveTo(upper.x, upper.y)
        context.lineTo(lower.x, lower.y)
      }
      context.stroke()
    }
    if (building.type === 'tower') rectangle(0.44, 0.56, elevation - 18, elevation - 9, '#565c51')
  }
}

function drawRoof(context: CanvasRenderingContext2D, building: Building) {
  const rise = roofRise(building)
  if (!rise) return
  const elevation = buildingElevation(building)
  const size = footprint(building)
  const [back, right, front, left] = buildingCorners(building).map(point => ({ x: point.x, y: point.y - elevation }))
  const ridgeStart = building.rotated ? tileToWorld(building.x, building.y + size.height / 2) : tileToWorld(building.x + size.width / 2, building.y)
  const ridgeEnd = building.rotated ? tileToWorld(building.x + size.width, building.y + size.height / 2) : tileToWorld(building.x + size.width / 2, building.y + size.height)
  ridgeStart.y -= elevation + rise
  ridgeEnd.y -= elevation + rise
  context.strokeStyle = '#794936'
  context.lineWidth = 0.7
  polygon(context, building.rotated ? [right, front, ridgeEnd] : [left, front, ridgeEnd], '#dacbab')
  const planes = building.rotated ? [[back, right, ridgeEnd, ridgeStart], [ridgeStart, ridgeEnd, front, left]] : [[back, ridgeStart, ridgeEnd, left], [ridgeStart, right, front, ridgeEnd]]
  planes.forEach((points, side) => {
    polygon(context, points, side ? '#a4523e' : '#cf7d59')
    context.strokeStyle = side ? '#874230' : '#b36348'
    context.lineWidth = 0.5
    for (let index = 1; index < 8; index++) {
      const fraction = index / 8
      context.beginPath()
      context.moveTo(points[0].x + (points[1].x - points[0].x) * fraction, points[0].y + (points[1].y - points[0].y) * fraction)
      context.lineTo(points[3].x + (points[2].x - points[3].x) * fraction, points[3].y + (points[2].y - points[3].y) * fraction)
      context.stroke()
    }
    for (let row = 1; row < 5; row++) {
      const fraction = row / 5
      context.beginPath()
      context.moveTo(points[0].x + (points[3].x - points[0].x) * fraction, points[0].y + (points[3].y - points[0].y) * fraction)
      context.lineTo(points[1].x + (points[2].x - points[1].x) * fraction, points[1].y + (points[2].y - points[1].y) * fraction)
      context.stroke()
    }
  })
  context.strokeStyle = '#f0b785'
  context.lineWidth = 1.5
  context.beginPath()
  context.moveTo(ridgeStart.x, ridgeStart.y)
  context.lineTo(ridgeEnd.x, ridgeEnd.y)
  context.stroke()
}

function drawTrees(context: CanvasRenderingContext2D, building: Building) {
  const size = footprint(building)
  const columns = building.type === 'orchard' ? Array.from({ length: size.width }, (_, index) => index + 0.5) : [0.45, size.width - 0.45]
  const rows = building.type === 'orchard' ? Array.from({ length: size.height }, (_, index) => index + 0.5) : [0.45, size.height - 0.45]
  for (const column of columns) for (const row of rows) {
    const point = tileToWorld(building.x + column, building.y + row)
    context.fillStyle = '#77563b'
    context.fillRect(point.x - 1.5, point.y - 12, 3, 12)
    context.fillStyle = '#2e6548'
    context.beginPath()
    context.ellipse(point.x, point.y - 15, 8, 10, 0, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#5b9362'
    context.beginPath()
    context.ellipse(point.x - 2, point.y - 18, 4, 6, 0, 0, Math.PI * 2)
    context.fill()
  }
}

function drawBuilding(context: CanvasRenderingContext2D, building: Building, city: City, view: ViewMode = 'isometric', occupants?: ReadonlyMap<number, Building>) {
  if (view === 'topdown') { drawSurface(context, building, city, occupants); return }
  const elevation = buildingElevation(building)
  if (['amphitheater', 'theater', 'villa', 'baths', 'market'].includes(building.type)) {
    if (building.type !== 'amphitheater' && building.type !== 'theater') drawSurface(context, building, city, occupants)
    context.save()
    context.transform(0.5, -0.5, 1, 1, 0, 0)
    if (building.type === 'villa') {
      for (const area of [[0.1, 0.1, 2.8, 0.55], [0.1, 0.65, 0.55, 1.7], [2.35, 0.65, 0.55, 1.7], [0.1, 2.35, 2.8, 0.55]] as [number, number, number, number][]) drawBlock(context, building, area, 0, elevation, '#c67d60', true)
    } else if (building.type === 'baths') {
      for (const area of [[0.1, 0.1, 2.8, 0.7], [0.1, 0.8, 0.65, 2.1]] as [number, number, number, number][]) drawBlock(context, building, area, 0, elevation, '#c67d60', true)
      for (let column = 1; column < 2.8; column += 0.35) drawBlock(context, building, [column, 2.75, 0.12, 0.12], 0, 12)
    } else if (building.type === 'market') {
      for (let column = 0.3; column < 2.6; column += 0.75) for (const row of [0.2, 1.35]) {
        drawBlock(context, building, [column, row, 0.55, 0.45], 0, 5, '#bf965d')
        for (const offset of [0, 0.48]) drawBlock(context, building, [column + offset, row, 0.06, 0.06], 5, 12, '#7c6850')
        drawBlock(context, building, [column - 0.04, row - 0.04, 0.63, 0.53], 12, 14, row < 1 ? '#bf6254' : '#e1bd67')
      }
    } else drawVenue(context, building)
    context.restore()
    return
  }
  if (building.type === 'bridge') drawSurface(context, { ...building, type: 'moat', x: building.x + (building.rotated ? 1 : 0), y: building.y + (building.rotated ? 0 : 1) }, city, occupants)
  if (elevation > 0) {
    context.save()
    context.transform(0.5, -0.5, 1, 1, 0, 0)
    const [, right, front, left] = buildingCorners(building)
    const plaster = ({ house: ['#e4c5a2', '#c5a07f'], insula: ['#d6b68c', '#b59872'], workshop: ['#c0b1a2', '#9f9186'], warehouse: ['#c5c2b2', '#a3a493'] } as Partial<Record<Building['type'], [string, string]>>)[building.type] ?? ['#ded0ae', '#b6aa8c']
    drawFacade(context, building, left, front, plaster[0])
    drawFacade(context, building, front, right, plaster[1])
    context.restore()
  }
  context.save()
  context.translate(-elevation, -elevation)
  drawSurface(context, building, city, occupants)
  context.restore()
  context.save()
  context.transform(0.5, -0.5, 1, 1, 0, 0)
  drawRoof(context, building)
  if (building.type === 'bakery') drawBlock(context, building, [0.35, 0.35, 0.28, 0.28], elevation + 6, elevation + 18, '#766d60')
  if (building.type === 'farm') {
    context.strokeStyle = '#ead391'
    context.lineWidth = 1.2
    for (let row = 0.3; row < 2.9; row += 0.3) for (let column = 0.3; column < 3.9; column += 0.3) {
      const point = modelPoint(building, column, row)
      context.beginPath()
      context.moveTo(point.x, point.y)
      context.lineTo(point.x, point.y - 5)
      context.moveTo(point.x - 2, point.y - 4)
      context.lineTo(point.x, point.y - 2)
      context.lineTo(point.x + 2, point.y - 4)
      context.stroke()
    }
  }
  if (building.type === 'wall' || building.type === 'tower' || building.type === 'gate') {
    const item = definition(building.type)
    for (let column = 0.05; column < item.width - 0.1; column += 0.32) for (const row of [0.06, item.height - 0.24]) drawBlock(context, building, [column, row, 0.18, 0.18], elevation, elevation + 6)
    if (building.type === 'tower') for (let row = 0.36; row < item.height - 0.25; row += 0.32) for (const column of [0.05, item.width - 0.23]) drawBlock(context, building, [column, row, 0.18, 0.18], elevation, elevation + 6)
    if (building.type === 'gate') for (const column of [0, item.width - 0.55]) drawBlock(context, building, [column, 0.12, 0.55, 0.76], elevation, elevation + 10)
  }
  if (building.type === 'bridge') for (const column of [0.07, 0.84]) drawBlock(context, building, [column, 0.08, 0.09, definition(building.type).height - 0.16], elevation, elevation + 4)
  if (building.type === 'garden' || building.type === 'orchard') drawTrees(context, building)
  if (building.type === 'statue') {
    const center = tileToWorld(building.x + 0.5, building.y + 0.5)
    context.strokeStyle = '#efede2'
    context.lineWidth = 5
    context.beginPath()
    context.moveTo(center.x, center.y - 14)
    context.lineTo(center.x, center.y - 30)
    context.stroke()
    context.fillStyle = '#f9f4e6'
    context.beginPath()
    context.arc(center.x, center.y - 33, 4, 0, Math.PI * 2)
    context.fill()
  }
  if (building.type === 'fountain') {
    const center = tileToWorld(building.x + 0.5, building.y + 0.5)
    context.strokeStyle = '#c3edf1'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(center.x, center.y - elevation)
    context.lineTo(center.x, center.y - elevation - 10)
    context.stroke()
  }
  context.restore()
}

const spriteCache = new Map<string, { canvas: HTMLCanvasElement; left: number; top: number; width: number; height: number }>()

function drawCachedBuilding(context: CanvasRenderingContext2D, building: Building, city: City, view: ViewMode = 'isometric', resolution = 1, occupants?: ReadonlyMap<number, Building>) {
  if (building.type === 'moat' || building.type === 'bridge') { drawBuilding(context, building, city, view, occupants); return }
  const key = `${building.type}:${building.rotated}:${view}:${resolution}`
  let sprite = spriteCache.get(key)
  if (!sprite) {
    const size = footprint(building)
    const left = view === 'topdown' ? -16 : -size.height * tileSize - 16
    const top = -80
    const width = (view === 'topdown' ? size.width : size.width + size.height) * tileSize + 32
    const height = (view === 'topdown' ? size.height * tileSize : (size.width + size.height) * tileSize / 2) + 112
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(width * resolution)
    canvas.height = Math.ceil(height * resolution)
    const spriteContext = canvas.getContext('2d')!
    spriteContext.scale(resolution, resolution)
    spriteContext.translate(-left, -top)
    if (view === 'isometric') spriteContext.transform(1, 0.5, -1, 0.5, 0, 0)
    drawBuilding(spriteContext, { ...building, x: 0, y: 0 }, city, view)
    sprite = { canvas, left, top, width, height }
    if (spriteCache.size >= 96) spriteCache.delete(spriteCache.keys().next().value!)
    spriteCache.set(key, sprite)
  }
  const position = tileToWorld(building.x, building.y, view)
  context.save()
  if (view === 'isometric') context.transform(0.5, -0.5, 1, 1, 0, 0)
  context.drawImage(sprite.canvas, position.x + sprite.left, position.y + sprite.top, sprite.width, sprite.height)
  context.restore()
}

function drawSurface(context: CanvasRenderingContext2D, building: Building, city: City, occupants?: ReadonlyMap<number, Building>) {
  const item = definition(building.type)
  const width = item.width * tileSize
  const height = item.height * tileSize
  context.save()
  context.translate(building.x * tileSize, building.y * tileSize)
  if (building.rotated) {
    context.translate(height, 0)
    context.rotate(Math.PI / 2)
  }
  context.strokeStyle = '#37443b'
  context.lineWidth = 1.5
  if (building.type !== 'amphitheater' && building.type !== 'theater') {
    context.fillStyle = item.color
    context.fillRect(2, 2, width - 4, height - 4)
    context.strokeRect(2, 2, width - 4, height - 4)
  }
  if (building.type === 'road' || building.type === 'square') {
    context.strokeStyle = '#858678'
    context.lineWidth = 1
    for (let row = 8; row < height; row += 8) {
      context.beginPath()
      context.moveTo(3, row)
      context.lineTo(width - 3, row)
      context.stroke()
      for (let column = 8 + (row % 16); column < width - 3; column += 16) {
        context.beginPath()
        context.moveTo(column, row - 6)
        context.lineTo(column, row)
        context.stroke()
      }
    }
  } else if (building.type === 'amphitheater' || building.type === 'theater') {
    const centerX = width / 2
    const centerY = height / 2
    for (let ring = 0; ring < 4; ring++) {
      context.fillStyle = ring % 2 ? '#b4a78b' : '#e8ddc3'
      context.beginPath()
      context.ellipse(centerX, centerY, width / 2 - 8 - ring * 7, height / 2 - 8 - ring * 5, 0, 0, building.type === 'theater' ? Math.PI : Math.PI * 2)
      context.closePath()
      context.fill()
      context.stroke()
    }
    context.fillStyle = '#d5b16f'
    context.beginPath()
    context.ellipse(centerX, centerY, width / 2 - 38, height / 2 - 28, 0, 0, building.type === 'theater' ? Math.PI : Math.PI * 2)
    context.closePath()
    context.fill()
    if (building.type === 'theater') {
      context.fillStyle = '#ae6950'
      context.fillRect(12, centerY - 12, width - 24, 12)
      context.fillStyle = '#e9dbc0'
      for (let column = 16; column < width - 16; column += 16) context.fillRect(column, centerY - 22, 5, 10)
    }
  } else if (building.type === 'wall' || building.type === 'tower' || building.type === 'gate') {
    context.fillStyle = '#e0d8bd'
    context.fillRect(3, 3, width - 6, height - 6)
    context.fillStyle = '#888d80'
    context.fillRect(8, 8, width - 16, height - 16)
    context.fillStyle = '#f1e6ca'
    for (let column = 4; column < width - 3; column += 10) {
      context.fillRect(column, 3, 6, 6)
      context.fillRect(column, height - 9, 6, 6)
    }
    if (building.type === 'tower') {
      for (let row = 4; row < height - 3; row += 10) {
        context.fillRect(3, row, 6, 6)
        context.fillRect(width - 9, row, 6, 6)
      }
    }
  } else if (building.type === 'bridge') {
    context.fillStyle = '#d8d1b8'
    context.fillRect(6, 2, width - 12, height - 4)
    context.fillStyle = '#888d81'
    context.fillRect(3, 2, 3, height - 4)
    context.fillRect(width - 6, 2, 3, height - 4)
    context.strokeStyle = '#a49f89'
    for (let row = 8; row < height; row += 10) {
      context.beginPath()
      context.moveTo(7, row)
      context.lineTo(width - 7, row)
      context.stroke()
    }
  } else if (building.type === 'farm') {
    context.fillStyle = '#b39c54'
    context.fillRect(4, 4, width - 8, height - 8)
    for (let row = 8; row < height - 6; row += 9) {
      context.fillStyle = '#637d3d'
      context.fillRect(7, row, width - 14, 3)
      context.fillStyle = '#e2c778'
      for (let column = 10; column < width - 8; column += 10) context.fillRect(column, row - 2, 2, 5)
    }
  } else if (building.type === 'moat') {
    const directions = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]
    const connected = directions.map(({ x, y }) => {
      const column = building.x + (building.rotated ? -y : x)
      const row = building.y + (building.rotated ? x : y)
      const neighbor = column < 0 || row < 0 || column >= city.width || row >= city.height ? undefined : occupants ? occupants.get(row * city.width + column) : buildingAt(city, column, row)
      return neighbor?.type === 'moat' || neighbor?.type === 'bridge'
    })
    if (!connected.some(Boolean)) { connected[0] = true; connected[2] = true }
    context.fillStyle = '#697e61'
    context.fillRect(0, 0, width, height)
    context.fillStyle = '#356b77'
    context.fillRect(3, 3, width - 6, height - 6)
    for (const [index, direction] of directions.entries()) if (connected[index]) context.fillRect(direction.x > 0 ? 16 : direction.x < 0 ? 0 : 3, direction.y > 0 ? 16 : direction.y < 0 ? 0 : 3, direction.x ? 16 : 26, direction.y ? 16 : 26)
    context.fillStyle = '#559fad'
    context.fillRect(6, 6, width - 12, height - 12)
    for (const [index, direction] of directions.entries()) if (connected[index]) context.fillRect(direction.x > 0 ? 16 : direction.x < 0 ? 0 : 6, direction.y > 0 ? 16 : direction.y < 0 ? 0 : 6, direction.x ? 16 : 20, direction.y ? 16 : 20)
    context.strokeStyle = '#a0d5d3'
    context.lineWidth = 1
    for (let row = 6; row < height; row += 10) {
      context.beginPath()
      context.moveTo(10, row)
      context.quadraticCurveTo(16, row + 3, 22, row)
      context.stroke()
    }
  } else if (building.type === 'orchard') {
    context.fillStyle = '#adc18c'
    context.fillRect(4, 4, width - 8, height - 8)
    for (let column = 16; column < width; column += 32) for (let row = 16; row < height; row += 32) {
      context.fillStyle = '#426b3f'
      context.beginPath()
      context.arc(column, row, 9, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = '#d9944c'
      context.fillRect(column - 4, row - 4, 3, 3)
      context.fillRect(column + 2, row + 2, 3, 3)
    }
  } else if (building.type === 'statue') {
    context.fillStyle = '#bdb79e'
    context.fillRect(5, 5, width - 10, height - 10)
    context.fillStyle = '#f7f0da'
    context.fillRect(10, 10, width - 20, height - 20)
  } else if (building.type === 'villa') {
    context.fillStyle = '#bd7259'
    context.fillRect(5, 5, width - 10, height - 10)
    context.fillStyle = '#e5d5b2'
    context.fillRect(18, 18, width - 36, height - 36)
    context.fillStyle = '#609167'
    context.fillRect(24, 24, width - 48, height - 48)
    context.fillStyle = '#72b5c3'
    context.fillRect(width / 2 - 6, height / 2 - 6, 12, 12)
  } else if (building.type === 'garden') {
    context.fillStyle = '#d5c9a0'
    context.fillRect(width / 2 - 3, 3, 6, height - 6)
    context.fillRect(3, height / 2 - 3, width - 6, 6)
    context.fillStyle = '#285c42'
    for (const offsetX of [15, width - 15]) for (const offsetY of [15, height - 15]) {
      context.beginPath()
      context.arc(offsetX, offsetY, 8, 0, Math.PI * 2)
      context.fill()
    }
  } else if (building.type === 'fountain') {
    context.fillStyle = '#dce2d2'
    context.beginPath()
    context.arc(width / 2, height / 2, 11, 0, Math.PI * 2)
    context.fill()
    context.stroke()
    context.fillStyle = '#469abe'
    context.beginPath()
    context.arc(width / 2, height / 2, 8, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#d2f0ee'
    context.fillRect(width / 2 - 2, height / 2 - 2, 4, 4)
  } else if (building.type === 'baths' || building.type === 'reservoir') {
    context.fillStyle = '#d8ddd1'
    context.fillRect(7, 7, width - 14, height - 14)
    context.fillStyle = '#438dba'
    const pool = building.type === 'baths' ? { x: 30, y: 31, width: width - 43, height: height - 47 } : { x: 10, y: 10, width: width - 20, height: height - 20 }
    context.fillRect(pool.x, pool.y, pool.width, pool.height)
    context.strokeStyle = '#eaf0da'
    context.strokeRect(pool.x - 2, pool.y - 2, pool.width + 4, pool.height + 4)
    context.strokeStyle = '#98d1d4'
    for (let row = pool.y + 8; row < pool.y + pool.height - 4; row += 10) {
      context.beginPath()
      context.moveTo(pool.x + 5, row)
      context.bezierCurveTo(pool.x + pool.width / 3, row - 3, pool.x + pool.width * 2 / 3, row + 3, pool.x + pool.width - 5, row)
      context.stroke()
    }
  } else if (building.type === 'aqueduct') {
    context.fillStyle = '#dad9c5'
    context.fillRect(4, 4, width - 8, height - 8)
    context.fillStyle = '#528dba'
    context.fillRect(width / 2 - 3, 0, 6, height)
    context.fillStyle = '#64766e'
    context.fillRect(3, 6, 5, 5)
    context.fillRect(width - 8, height - 11, 5, 5)
  } else if (['forum', 'temple', 'basilica', 'library'].includes(building.type)) {
    context.fillStyle = '#f2eddf'
    context.fillRect(8, 8, width - 16, height - 16)
    context.fillStyle = '#b8ac8f'
    context.fillRect(18, 18, width - 36, height - 36)
    context.fillStyle = '#fbf6e7'
    for (let column = 14; column < width - 10; column += 16) {
      context.fillRect(column, 9, 5, 9)
      context.fillRect(column, height - 18, 5, 9)
    }
  } else if (building.type === 'market') {
    context.fillStyle = '#d9c8a1'
    context.fillRect(7, 7, width - 14, height - 14)
    for (let column = 10; column + 17 < width - 3; column += 23) {
      context.fillStyle = '#b95243'
      context.fillRect(column, 10, 17, 13)
      context.fillStyle = '#efdca6'
      context.fillRect(column, height - 23, 17, 13)
    }
  } else {
    context.fillStyle = '#daaf80'
    context.fillRect(7, 7, width - 14, height - 14)
    context.fillStyle = item.color
    context.fillRect(10, 10, width - 20, height - 20)
    context.strokeStyle = '#713f35'
    context.beginPath()
    context.moveTo(width / 2, 10)
    context.lineTo(width / 2, height - 10)
    context.moveTo(10, 10)
    context.lineTo(width / 2, 20)
    context.lineTo(width - 10, 10)
    context.stroke()
    if (building.type === 'bakery') {
      context.fillStyle = '#584733'
      context.beginPath()
      context.arc(width / 2, height / 2, 10, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = '#e9ba69'
      context.fillRect(width / 2 - 5, height / 2 - 3, 10, 6)
    } else if (building.type === 'workshop') {
      context.fillStyle = '#4f6464'
      context.fillRect(16, 16, 12, 16)
      context.fillStyle = '#d3b277'
      context.fillRect(34, 18, 14, 10)
    } else if (building.type === 'school') {
      context.fillStyle = '#f2e3bb'
      for (let row = 19; row < height - 14; row += 12) context.fillRect(17, row, width - 34, 5)
    } else if (building.type !== 'warehouse') {
      context.fillStyle = '#e6d5af'
      context.fillRect(width / 2 - 8, height / 2 - 8, 16, 16)
      context.fillStyle = '#5d936d'
      context.fillRect(width / 2 - 4, height / 2 - 4, 8, 8)
    }
  }
  context.restore()
}
export type SelectionOverlay = {
  buildings: readonly Building[]
  moving: readonly Building[] | null
  valid: boolean
  area: { from: { x: number; y: number }; to: { x: number; y: number } } | null
}

const sceneCache = new WeakMap<HTMLCanvasElement, {
  layer: HTMLCanvasElement
  width: number
  height: number
  ratio: number
  cityWidth: number
  cityHeight: number
  camera: Camera
  buildings: Building[]
}>()

function drawCity(context: CanvasRenderingContext2D, city: City, camera: Camera, width: number, height: number, ratio: number) {
  const occupants = new Map<number, Building>()
  for (const building of city.buildings) {
    const size = footprint(building)
    for (let row = building.y; row < building.y + size.height; row++) for (let column = building.x; column < building.x + size.width; column++) occupants.set(row * city.width + column, building)
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.fillStyle = '#e2e7e1'
  context.fillRect(0, 0, width, height)
  context.translate(camera.x, camera.y)
  context.scale(camera.zoom, camera.zoom)
  if (camera.view !== 'topdown') context.transform(1, 0.5, -1, 0.5, 0, 0)
  context.fillStyle = '#b6c7a2'
  context.fillRect(0, 0, city.width * tileSize, city.height * tileSize)
  context.strokeStyle = '#a6b897'
  context.lineWidth = 0.7 / camera.zoom
  context.beginPath()
  for (let column = 0; column <= city.width; column++) {
    context.moveTo(column * tileSize, 0)
    context.lineTo(column * tileSize, city.height * tileSize)
  }
  for (let row = 0; row <= city.height; row++) {
    context.moveTo(0, row * tileSize)
    context.lineTo(city.width * tileSize, row * tileSize)
  }
  context.stroke()
  const ordered = drawOrder(city.buildings).filter(building => {
    const size = footprint(building)
    const corners = [tileToWorld(building.x, building.y, camera.view), tileToWorld(building.x + size.width, building.y, camera.view), tileToWorld(building.x + size.width, building.y + size.height, camera.view), tileToWorld(building.x, building.y + size.height, camera.view)]
    const left = camera.x + (Math.min(...corners.map(point => point.x)) - 32) * camera.zoom
    const right = camera.x + (Math.max(...corners.map(point => point.x)) + 32) * camera.zoom
    const top = camera.y + (Math.min(...corners.map(point => point.y)) - 80) * camera.zoom
    const bottom = camera.y + (Math.max(...corners.map(point => point.y)) + 48) * camera.zoom
    return right >= 0 && left <= width && bottom >= 0 && top <= height
  })
  const resolution = Math.max(1, Math.ceil(camera.zoom * ratio))
  for (const building of ordered) if (buildingElevation(building) === 0) drawCachedBuilding(context, building, city, camera.view, resolution, occupants)
  if (camera.view !== 'topdown') {
    context.fillStyle = '#29433626'
    for (const building of ordered) {
      const elevation = buildingElevation(building)
      if (!elevation) continue
      const size = footprint(building)
      const offset = elevation * 0.3
      context.fillRect(building.x * tileSize + offset, building.y * tileSize + offset, size.width * tileSize, size.height * tileSize)
    }
  }
  for (const building of ordered) if (buildingElevation(building) > 0) drawCachedBuilding(context, building, city, camera.view, resolution, occupants)
}

export function render(canvas: HTMLCanvasElement, city: City, camera: Camera, preview: Building | null, highlight: Building | undefined, erase: boolean, selection?: SelectionOverlay) {
  const context = canvas.getContext('2d')!
  const ratio = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
  }
  let cached = sceneCache.get(canvas)
  if (!cached || cached.width !== width || cached.height !== height || cached.ratio !== ratio || cached.cityWidth !== city.width || cached.cityHeight !== city.height || cached.camera.x !== camera.x || cached.camera.y !== camera.y || cached.camera.zoom !== camera.zoom || cached.camera.view !== camera.view || cached.buildings.length !== city.buildings.length || cached.buildings.some((previous, index) => {
    const building = city.buildings[index]
    return previous.type !== building.type || previous.x !== building.x || previous.y !== building.y || previous.rotated !== building.rotated
  })) {
    const layer = cached?.layer ?? document.createElement('canvas')
    layer.width = canvas.width
    layer.height = canvas.height
    drawCity(layer.getContext('2d')!, city, camera, width, height, ratio)
    cached = { layer, width, height, ratio, cityWidth: city.width, cityHeight: city.height, camera: { ...camera }, buildings: city.buildings.map(building => ({ ...building })) }
    sceneCache.set(canvas, cached)
  }
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.drawImage(cached.layer, 0, 0)
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.translate(camera.x, camera.y)
  context.scale(camera.zoom, camera.zoom)
  if (camera.view !== 'topdown') context.transform(1, 0.5, -1, 0.5, 0, 0)
  if (selection) {
    for (const building of selection.buildings) {
      const size = footprint(building)
      context.fillStyle = '#367fa22b'
      context.strokeStyle = '#216484'
      context.lineWidth = 2 / camera.zoom
      context.fillRect(building.x * tileSize, building.y * tileSize, size.width * tileSize, size.height * tileSize)
      context.strokeRect(building.x * tileSize + 1, building.y * tileSize + 1, size.width * tileSize - 2, size.height * tileSize - 2)
    }
    if (selection.moving) {
      context.save()
      context.globalAlpha = 0.65
      for (const building of drawOrder(selection.moving)) drawBuilding(context, building, city, camera.view)
      context.restore()
      context.strokeStyle = selection.valid ? '#126446' : '#ba3030'
      context.lineWidth = 2 / camera.zoom
      for (const building of selection.moving) {
        const size = footprint(building)
        context.strokeRect(building.x * tileSize, building.y * tileSize, size.width * tileSize, size.height * tileSize)
      }
    }
    if (selection.area) {
      const { from, to } = selection.area
      const left = Math.min(from.x, to.x) * tileSize
      const top = Math.min(from.y, to.y) * tileSize
      const areaWidth = (Math.abs(from.x - to.x) + 1) * tileSize
      const areaHeight = (Math.abs(from.y - to.y) + 1) * tileSize
      context.fillStyle = '#367fa21a'
      context.strokeStyle = '#216484'
      context.lineWidth = 1.5 / camera.zoom
      context.setLineDash([5 / camera.zoom, 3 / camera.zoom])
      context.fillRect(left, top, areaWidth, areaHeight)
      context.strokeRect(left, top, areaWidth, areaHeight)
      context.setLineDash([])
    }
  }
  const overlay = preview || highlight
  if (preview) {
    context.save()
    context.globalAlpha = 0.55
    drawBuilding(context, preview, city, camera.view)
    context.restore()
  }
  if (overlay) {
    const size = footprint(overlay)
    const valid = preview ? canPlace(city, preview) : !erase
    context.fillStyle = valid ? '#15785640' : '#c2383840'
    context.strokeStyle = valid ? '#126446' : '#ba3030'
    context.lineWidth = 2 / camera.zoom
    context.fillRect(overlay.x * tileSize, overlay.y * tileSize, size.width * tileSize, size.height * tileSize)
    context.strokeRect(overlay.x * tileSize + 1, overlay.y * tileSize + 1, size.width * tileSize - 2, size.height * tileSize - 2)
  }
}