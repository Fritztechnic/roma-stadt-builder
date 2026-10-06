import { Bath, Box, Building2, createIcons, Download, Droplets, Eraser, Expand, FilePlus2, FolderOpen, Grid2X2, Hand, House, Landmark, Map, MousePointer2, Redo2, RotateCw, Route, Save, Scan, Store, Trees, Undo2, Upload, Warehouse, Waves, ZoomIn, ZoomOut } from 'lucide'
import './app.css'
import type { Building, BuildingType, City } from './city.ts'
import { buildingAt, buildingsInArea, canPlace, canReplaceBuildings, catalog, definition, emptyCity, expandCity, footprint, History, parseCity, replaceBuildings } from './city.ts'
import { romanPreset } from './preset.ts'
import type { Camera, ViewMode } from './render.ts'
import { buildingAtScreen, fitCamera, render, screenToTile } from './render.ts'

const storageKey = 'roma-city-v1'
const icons = { Route, Grid2X2, Droplets, Waves, House, Building2, Landmark, Store, Bath, Warehouse, Trees, MousePointer2, Hand, Eraser, Expand, RotateCw, Undo2, Redo2, Save, FolderOpen, Download, Upload, FilePlus2, ZoomIn, ZoomOut, Scan, Map, Box }
function tool(id: string, icon: string, title: string) {
  return `<button id="${id}" title="${title}" aria-label="${title}"><i data-lucide="${icon}"></i></button>`
}
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header><div class="brand">ROMA <span>Stadtbau</span></div>
    <div class="tools" role="toolbar" aria-label="Stadtdatei">
      ${tool('new', 'file-plus-2', 'Neue Stadt')}${tool('save', 'save', 'Lokal speichern')}${tool('load', 'folder-open', 'Lokale Stadt laden')}
      ${tool('export', 'download', 'Stadt exportieren')}${tool('import', 'upload', 'Stadt importieren')}
      ${tool('preset', 'map', 'Roemische Beispielstadt laden')}
      ${tool('expand', 'expand', 'Karte vergroessern')}
    </div><div class="separator"></div>
    <div class="tools" role="toolbar" aria-label="Verlauf">${tool('undo', 'undo-2', 'Rueckgaengig')}${tool('redo', 'redo-2', 'Wiederholen')}</div>
    <span id="save-state">Sandbox</span>
  </header>
  <main><aside><h2>Baukatalog</h2>
    <div class="tools modes" role="toolbar" aria-label="Werkzeug">
      ${tool('inspect', 'mouse-pointer-2', 'Auswaehlen')}${tool('pan', 'hand', 'Karte verschieben')}${tool('erase', 'eraser', 'Abreissen')}${tool('rotate', 'rotate-cw', 'Gebaeude drehen')}
    </div><div id="catalog">${[...new Set(catalog.map(item => item.group))].map(group => `
      <h3>${group}</h3>${catalog.filter(item => item.group === group).map(item => `<button class="building" data-type="${item.type}" aria-pressed="false"><i data-lucide="${item.icon}"></i><span>${item.name}</span><small>${item.width} x ${item.height}</small></button>`).join('')}`).join('')}
    </div><section class="selection"><strong id="selected-name">Strasse</strong><span id="selected-size">1 x 1 Felder</span></section>
  </aside><section class="map"><canvas tabindex="0" aria-label="Stadtkarte" aria-describedby="hover-label"></canvas>
    <div id="hover-label" role="tooltip" hidden></div>
    <div class="views" role="group" aria-label="Ansicht">
      <button id="view-topdown" title="Draufsicht" aria-pressed="false"><i data-lucide="grid-2-x-2"></i>Draufsicht</button>
      <button id="view-isometric" title="Isometrische Ansicht" aria-pressed="true"><i data-lucide="box"></i>Isometrie</button>
    </div>
    <div class="zoom tools" role="toolbar" aria-label="Kamera">${tool('zoom-out', 'zoom-out', 'Verkleinern')}<output id="zoom-value"></output>${tool('zoom-in', 'zoom-in', 'Vergroessern')}${tool('fit', 'scan', 'Ganze Karte')}</div>
  </section></main>
  <footer><span id="status" role="status" aria-live="polite">Bereit</span><span id="coordinates"></span><span id="count"></span></footer>
  <input id="file" type="file" accept=".json,application/json" hidden>
`
createIcons({ icons })
const canvas = document.querySelector('canvas')!
const camera: Camera = { x: 0, y: 0, zoom: 1, view: 'isometric' }
try { if (localStorage.getItem('roma-view-v1') === 'topdown') camera.view = 'topdown' } catch { }
const history = new History()
let city = emptyCity()
let selected: BuildingType = 'road'
let mode: 'build' | 'inspect' | 'pan' | 'erase' = 'build'
let rotated = false
let hover: { x: number; y: number } | null = null
let pointer: { x: number; y: number } | null = null
let spaceDown = false
let selectedBuildings: Building[] = []
let gesture: { kind: 'paint' | 'pan' | 'select' | 'move'; before: string; lastX: number; lastY: number; tile: { x: number; y: number }; baseSelection: Building[] } | null = null
let statusTimer: ReturnType<typeof setTimeout>
function button(id: string) { return document.getElementById(id) as HTMLButtonElement }
function status(message: string) {
  document.getElementById('status')!.textContent = message
  clearTimeout(statusTimer)
  statusTimer = setTimeout(() => { document.getElementById('status')!.textContent = 'Bereit' }, 5000)
}
function save(announce = false) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(city))
    document.getElementById('save-state')!.textContent = 'Lokal gespeichert'
    if (announce) status('Stadt gespeichert.')
  } catch {
    document.getElementById('save-state')!.textContent = 'Nicht gespeichert'
    status('Lokales Speichern nicht moeglich. Bitte Stadt exportieren.')
  }
}
try {
  const saved = localStorage.getItem(storageKey)
  if (saved) city = parseCity(saved)
} catch { status('Lokaler Spielstand konnte nicht geladen werden. Die Datei bleibt unveraendert.') }
function movedBuildings() {
  if (gesture?.kind !== 'move' || !hover) return null
  const offsetX = hover.x - gesture.tile.x
  const offsetY = hover.y - gesture.tile.y
  return selectedBuildings.map(building => ({ ...building, x: building.x + offsetX, y: building.y + offsetY }))
}
let framePending = false
function refresh() {
  if (framePending) return
  framePending = true
  requestAnimationFrame(() => { framePending = false; drawFrame() })
}
function drawFrame() {
  for (const view of ['topdown', 'isometric'] as const) {
    button(`view-${view}`).classList.toggle('active', camera.view === view)
    button(`view-${view}`).setAttribute('aria-pressed', String(camera.view === view))
    button(`view-${view}`).disabled = gesture !== null
  }
  const preview = mode === 'build' && hover && !spaceDown && gesture?.kind !== 'pan' ? { type: selected, ...hover, rotated } : null
  const target = hover && pointer && !spaceDown && !gesture ? buildingAtScreen(city, camera, pointer.x, pointer.y) : undefined
  const highlight = mode === 'inspect' || mode === 'erase' ? target : undefined
  const label = document.getElementById('hover-label')!
  label.hidden = !target
  if (target && pointer) {
    const size = footprint(target)
    label.textContent = `${definition(target.type).name} - ${size.width} x ${size.height}`
    label.style.left = `${Math.max(8, Math.min(pointer.x + 14, canvas.clientWidth - label.offsetWidth - 8))}px`
    label.style.top = `${Math.max(8, Math.min(pointer.y + 14, canvas.clientHeight - label.offsetHeight - 8))}px`
  }
  const moving = movedBuildings()
  render(canvas, city, camera, preview, highlight, mode === 'erase', {
    buildings: selectedBuildings,
    moving,
    valid: moving ? canReplaceBuildings(city, selectedBuildings, moving) : true,
    area: gesture?.kind === 'select' && hover ? { from: gesture.tile, to: hover } : null,
  })
  button('undo').disabled = !history.canUndo
  button('redo').disabled = !history.canRedo
  button('expand').disabled = gesture !== null || (city.width >= 128 && city.height >= 128)
  button('rotate').disabled = mode !== 'build' && (mode !== 'inspect' || selectedBuildings.length === 0)
  for (const toolMode of ['inspect', 'pan', 'erase'] as const) {
    button(toolMode).classList.toggle('active', mode === toolMode)
    button(toolMode).setAttribute('aria-pressed', String(mode === toolMode))
  }
  document.querySelectorAll<HTMLButtonElement>('[data-type]').forEach(entry => {
    const active = mode === 'build' && entry.dataset.type === selected
    entry.classList.toggle('active', active)
    entry.setAttribute('aria-pressed', String(active))
  })
  document.getElementById('zoom-value')!.textContent = `${Math.round(camera.zoom * 100)}%`
  document.getElementById('count')!.textContent = `${city.width} x ${city.height} | ${city.buildings.length} Objekte`
  document.getElementById('coordinates')!.textContent = hover && hover.x >= 0 && hover.y >= 0 && hover.x < city.width && hover.y < city.height ? `${hover.x + 1}, ${hover.y + 1}` : ''
  const item = highlight ? definition(highlight.type) : mode === 'build' ? definition(selected) : null
  document.getElementById('selected-name')!.textContent = item?.name ?? ({ inspect: 'Auswahl', pan: 'Kamera', erase: 'Abriss', build: '' })[mode]
  const size = highlight ? footprint(highlight) : item ? footprint({ type: selected, x: 0, y: 0, rotated }) : null
  document.getElementById('selected-size')!.textContent = size ? `${size.width} x ${size.height} Felder` : ''
  if (mode === 'inspect' && selectedBuildings.length) {
    document.getElementById('selected-name')!.textContent = selectedBuildings.length === 1 ? definition(selectedBuildings[0].type).name : `${selectedBuildings.length} Objekte`
    document.getElementById('selected-size')!.textContent = 'Ausgewaehlt'
  }
  canvas.style.cursor = spaceDown || mode === 'pan' || gesture?.kind === 'pan' ? gesture ? 'grabbing' : 'grab' : mode === 'inspect' ? 'default' : 'crosshair'
}
function fit() { fitCamera(camera, city, canvas.clientWidth, canvas.clientHeight); refresh() }
function switchView(view: ViewMode) {
  if (gesture || camera.view === view) return
  camera.view = view
  hover = null
  pointer = null
  try { localStorage.setItem('roma-view-v1', view) } catch { }
  fit()
}
button('view-topdown').onclick = () => switchView('topdown')
button('view-isometric').onclick = () => switchView('isometric')
function commit(before: string) { if (history.record(before, city)) save(); refresh() }
function point(event: PointerEvent | WheelEvent) {
  const bounds = canvas.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}
function paint(tile: { x: number; y: number }, announce = false) {
  if (mode === 'erase') {
    const target = announce && pointer ? buildingAtScreen(city, camera, pointer.x, pointer.y) : buildingAt(city, tile.x, tile.y)
    if (target) city.buildings.splice(city.buildings.indexOf(target), 1)
  } else if (mode === 'build') {
    const building = { type: selected, ...tile, rotated }
    if (canPlace(city, building)) city.buildings.push(building)
    else if (announce) status('Hier ist kein freier Bauplatz.')
  }
}
function stroke(from: { x: number; y: number }, to: { x: number; y: number }) {
  let currentX = from.x
  let currentY = from.y
  while (currentX !== to.x) { currentX += Math.sign(to.x - currentX); paint({ x: currentX, y: currentY }) }
  while (currentY !== to.y) { currentY += Math.sign(to.y - currentY); paint({ x: currentX, y: currentY }) }
}
function rotateBuildings(targets: Building[]) {
  const replacements = targets.map(building => ({ ...building, rotated: !building.rotated }))
  const before = JSON.stringify(city)
  if (replaceBuildings(city, targets, replacements)) {
    selectedBuildings = replacements
    commit(before)
  } else status('Drehen nicht moeglich: Bauplatz belegt oder ausserhalb der Karte.')
}
function rotateActive() {
  if (mode === 'build') { rotated = !rotated; refresh() }
  else if (mode === 'inspect' && selectedBuildings.length) { rotateBuildings(selectedBuildings); refresh() }
}
canvas.addEventListener('pointerdown', event => {
  if (gesture || ![0, 1, 2].includes(event.button)) return
  canvas.focus()
  const position = point(event)
  pointer = position
  const tile = screenToTile(camera, position.x, position.y)
  hover = tile
  if (event.button === 2 && !spaceDown && mode !== 'pan') {
    const target = buildingAtScreen(city, camera, position.x, position.y)
    if (target) {
      mode = 'inspect'
      rotateBuildings(selectedBuildings.includes(target) ? selectedBuildings : [target])
    } else rotateActive()
    refresh()
    return
  }
  if (event.button !== 0 || spaceDown || mode === 'pan') {
    gesture = { kind: 'pan', before: '', lastX: position.x, lastY: position.y, tile, baseSelection: [] }
  } else if (mode === 'inspect' || event.shiftKey) {
    mode = 'inspect'
    const target = buildingAtScreen(city, camera, position.x, position.y)
    if (target && event.shiftKey) {
      selectedBuildings = selectedBuildings.includes(target) ? selectedBuildings.filter(building => building !== target) : [...selectedBuildings, target]
    } else if (target) {
      if (!selectedBuildings.includes(target)) selectedBuildings = [target]
      gesture = { kind: 'move', before: JSON.stringify(city), lastX: position.x, lastY: position.y, tile, baseSelection: [] }
    } else {
      const baseSelection = event.shiftKey ? [...selectedBuildings] : []
      selectedBuildings = baseSelection
      gesture = { kind: 'select', before: '', lastX: position.x, lastY: position.y, tile, baseSelection }
    }
  } else {
    gesture = { kind: 'paint', before: JSON.stringify(city), lastX: position.x, lastY: position.y, tile, baseSelection: [] }
    paint(tile, true)
  }
  if (gesture) canvas.setPointerCapture(event.pointerId)
  refresh()
})
canvas.addEventListener('pointermove', event => {
  const position = point(event)
  pointer = position
  if (gesture?.kind === 'pan') {
    camera.x += position.x - gesture.lastX
    camera.y += position.y - gesture.lastY
    gesture.lastX = position.x
    gesture.lastY = position.y
  }
  hover = screenToTile(camera, position.x, position.y)
  if (gesture?.kind === 'select') selectedBuildings = [...new Set([...gesture.baseSelection, ...buildingsInArea(city, gesture.tile, hover)])]
  if (gesture?.kind === 'paint' && (mode === 'erase' || selected === 'road' || selected === 'aqueduct' || selected === 'wall' || selected === 'moat')) {
    stroke(gesture.tile, hover)
    gesture.tile = hover
  }
  refresh()
})
function finishGesture() {
  if (!gesture) return
  const previous = gesture
  const replacements = movedBuildings()
  gesture = null
  if (previous.kind === 'move' && replacements) {
    if (replaceBuildings(city, selectedBuildings, replacements)) {
      selectedBuildings = replacements
      commit(previous.before)
    } else { status('Verschieben nicht moeglich: Bauplatz belegt oder ausserhalb der Karte.'); refresh() }
    return
  }
  if (previous.kind === 'paint') commit(previous.before)
  else refresh()
}
canvas.addEventListener('pointerup', finishGesture)
canvas.addEventListener('pointercancel', () => {
  if (gesture?.kind === 'move' || gesture?.kind === 'select') { gesture = null; refresh() }
  else finishGesture()
})
canvas.addEventListener('lostpointercapture', finishGesture)
canvas.addEventListener('pointerleave', () => { if (!gesture) { hover = null; pointer = null; refresh() } })
canvas.addEventListener('contextmenu', event => event.preventDefault())
function zoom(factor: number, x = canvas.clientWidth / 2, y = canvas.clientHeight / 2) {
  const next = Math.max(0.05, Math.min(3, camera.zoom * factor))
  const ratio = next / camera.zoom
  camera.x = x - (x - camera.x) * ratio
  camera.y = y - (y - camera.y) * ratio
  camera.zoom = next
  hover = null
  refresh()
}
canvas.addEventListener('wheel', event => {
  event.preventDefault()
  if (gesture) return
  const position = point(event)
  zoom(Math.exp(-event.deltaY * 0.001), position.x, position.y)
}, { passive: false })
document.querySelectorAll<HTMLButtonElement>('[data-type]').forEach(entry => entry.addEventListener('click', () => {
  selected = entry.dataset.type as BuildingType
  mode = 'build'
  rotated = false
  selectedBuildings = []
  refresh()
}))
for (const toolMode of ['inspect', 'pan', 'erase'] as const) button(toolMode).onclick = () => { mode = toolMode; if (mode !== 'inspect') selectedBuildings = []; refresh() }
button('rotate').onclick = rotateActive
button('fit').onclick = fit
button('zoom-in').onclick = () => zoom(1.2)
button('zoom-out').onclick = () => zoom(1 / 1.2)
button('undo').onclick = () => { city = history.undo(city); selectedBuildings = []; save(); refresh() }
button('redo').onclick = () => { city = history.redo(city); selectedBuildings = []; save(); refresh() }
button('save').onclick = () => save(true)
button('expand').onclick = () => {
  if (gesture || (city.width >= 128 && city.height >= 128)) return
  const before = JSON.stringify(city)
  city = expandCity(city)
  hover = null
  pointer = null
  commit(before)
  fit()
  status(`Karte auf ${city.width} x ${city.height} Felder erweitert.`)
}
function replaceCity(next: City) {
  const before = JSON.stringify(city)
  city = next
  selectedBuildings = []
  commit(before)
  fit()
}
button('new').onclick = () => {
  if (confirm('Eine leere Stadt starten? Die aktuelle Stadt wird ersetzt.')) { replaceCity(emptyCity()); save(); status('Neue Stadt gestartet.') }
}
button('preset').onclick = () => {
  if (confirm('Roemische Beispielstadt laden? Die aktuelle Stadt wird ersetzt.')) {
    replaceCity(romanPreset())
    mode = 'inspect'
    save()
    status('Roemische Beispielstadt geladen.')
    refresh()
  }
}
button('load').onclick = () => {
  try {
    const text = localStorage.getItem(storageKey)
    if (!text) { status('Kein lokaler Spielstand vorhanden.'); return }
    const next = parseCity(text)
    if (confirm('Lokalen Spielstand laden und aktuelle Stadt ersetzen?')) { replaceCity(next); status('Stadt geladen.') }
  } catch { status('Spielstand konnte nicht geladen werden.') }
}
button('export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(city, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'roma-stadt.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  status('Stadt exportiert.')
}
const fileInput = document.getElementById('file') as HTMLInputElement
button('import').onclick = () => fileInput.click()
fileInput.onchange = async () => {
  const file = fileInput.files?.[0]
  fileInput.value = ''
  if (!file) return
  try {
    if (file.size > 2_000_000) throw new Error('Datei ist zu gross (maximal 2 MB).')
    const next = parseCity(await file.text())
    if (confirm('Importieren und aktuelle Stadt ersetzen?')) { replaceCity(next); save(); status('Stadt importiert.') }
  } catch (error) { status(error instanceof Error ? error.message : 'Import fehlgeschlagen.') }
}
window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || gesture) return
  const modifier = event.ctrlKey || event.metaKey
  if (modifier && event.code === 'KeyS') { event.preventDefault(); save(true); return }
  if (modifier && (event.code === 'KeyZ' || event.code === 'KeyY')) {
    event.preventDefault()
    if (event.shiftKey || event.code === 'KeyY') button('redo').click()
    else button('undo').click()
    return
  }
  if (event.code === 'Space') { event.preventDefault(); spaceDown = true }
  if (event.code === 'KeyR' && !modifier) rotateActive()
  if (event.code === 'Escape') { mode = 'inspect'; hover = null; selectedBuildings = [] }
  if (modifier && event.code === 'KeyA' && document.activeElement === canvas) { event.preventDefault(); mode = 'inspect'; selectedBuildings = [...city.buildings] }
  if (event.code === 'Delete' && mode === 'inspect' && selectedBuildings.length) {
    event.preventDefault()
    const before = JSON.stringify(city)
    city.buildings = city.buildings.filter(building => !selectedBuildings.includes(building))
    selectedBuildings = []
    commit(before)
  } else if (event.code === 'Delete' || event.code === 'KeyE') { mode = 'erase'; selectedBuildings = [] }
  refresh()
})
window.addEventListener('keyup', event => { if (event.code === 'Space') { spaceDown = false; refresh() } })
window.addEventListener('blur', () => { finishGesture(); spaceDown = false; refresh() })
new ResizeObserver(() => refresh()).observe(canvas)
fit()