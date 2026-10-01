import type { Building, City } from './city.ts';
import { canPlace, definition, footprint } from './city.ts';

export type Camera = { x: number; y: number; zoom: number }
export const tileSize = 32
export function screenToTile(camera: Camera, x: number, y: number) {
  return { x: Math.floor((x - camera.x) / (tileSize * camera.zoom)), y: Math.floor((y - camera.y) / (tileSize * camera.zoom)) }
}
export function fitCamera(camera: Camera, city: City, width: number, height: number) {
  camera.zoom = Math.min(1.5, (width - 64) / (city.width * tileSize), (height - 64) / (city.height * tileSize))
  camera.x = (width - city.width * tileSize * camera.zoom) / 2
  camera.y = (height - city.height * tileSize * camera.zoom) / 2
}
function drawBuilding(context: CanvasRenderingContext2D, building: Building) {
  const item = definition(building.type)
  const width = item.width * tileSize
  const height = item.height * tileSize
  context.save()
  context.translate(building.x * tileSize, building.y * tileSize)
  if (building.rotated) {
    context.translate(height, 0)
    context.rotate(Math.PI / 2)
  }
  context.fillStyle = item.color
  context.fillRect(2, 2, width - 4, height - 4)
  context.strokeStyle = '#37443b'
  context.lineWidth = 1.5
  context.strokeRect(2, 2, width - 4, height - 4)
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
  } else if (building.type === 'fountain' || building.type === 'baths') {
    context.fillStyle = '#d8ddd1'
    context.fillRect(7, 7, width - 14, height - 14)
    context.fillStyle = '#438dba'
    context.fillRect(10, 10, width - 20, height - 20)
    context.fillStyle = '#bce4ea'
    context.fillRect(width / 2 - 2, 12, 4, height - 24)
  } else if (building.type === 'aqueduct') {
    context.fillStyle = '#dad9c5'
    context.fillRect(4, 4, width - 8, height - 8)
    context.fillStyle = '#528dba'
    context.fillRect(width / 2 - 3, 0, 6, height)
    context.fillStyle = '#64766e'
    context.fillRect(3, 6, 5, 5)
    context.fillRect(width - 8, height - 11, 5, 5)
  } else if (building.type === 'forum' || building.type === 'temple') {
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
    for (let column = 10; column < width - 16; column += 23) {
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
    if (building.type !== 'warehouse') {
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

export function render(canvas: HTMLCanvasElement, city: City, camera: Camera, preview: Building | null, highlight: Building | undefined, erase: boolean, selection?: SelectionOverlay) {
  const context = canvas.getContext('2d')!
  const ratio = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.fillStyle = '#e2e7e1'
  context.fillRect(0, 0, width, height)
  context.translate(camera.x, camera.y)
  context.scale(camera.zoom, camera.zoom)
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
  for (const building of city.buildings) drawBuilding(context, building)
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
      for (const building of selection.moving) drawBuilding(context, building)
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