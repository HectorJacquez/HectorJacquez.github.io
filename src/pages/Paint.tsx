import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { sfx } from '../sfx'

const MODEL = `${import.meta.env.BASE_URL}models/CRT.glb?v=3`
const PAINT_SCRIPT = `${import.meta.env.BASE_URL}play/paint/hedgy-paint.js`
const PAINT_RES = 512
const UNDO_CAP = 20
const SWATCHES = ['#f2a65a', '#e0533d', '#e58fb1', '#9ece6a', '#4ec9b0',
  '#7aa2f7', '#9a6fd0', '#f2efe8', '#8a5a3b', '#1b1b1f']

type Tool = 'brush' | 'fill' | 'stamp' | 'orbit'

/* eslint-disable @typescript-eslint/no-explicit-any */
interface SceneState {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera
  controls: OrbitControls; root: THREE.Object3D | null; pcs: any[]
  undoStack: { pc: any; data: ImageData }[]; sticker: HTMLCanvasElement
  HP: any; painting: boolean; strokePointer: number | null; last: any; activePC: any
  tool: Tool; color: string; brushSize: number; animId: number
}

type Sticker = { id: string; draw: (x: CanvasRenderingContext2D) => void }

function starPath(x: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outer: number, inner: number) {
  let rot = -Math.PI / 2
  const step = Math.PI / spikes
  x.beginPath()
  x.moveTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer)
  for (let i = 0; i < spikes; i++) {
    rot += step; x.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner)
    rot += step; x.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer)
  }
  x.closePath()
}

/** White sticker border + colored fill + a faint dark edge, on the current path. */
function fillSticker(x: CanvasRenderingContext2D, color: string) {
  x.lineJoin = 'round'; x.lineCap = 'round'
  x.lineWidth = 15; x.strokeStyle = '#fff'; x.stroke()
  x.fillStyle = color; x.fill()
  x.lineWidth = 2; x.strokeStyle = 'rgba(0,0,0,0.18)'; x.stroke()
}

const STICKERS: Sticker[] = [
  { id: 'star', draw: (x) => { starPath(x, 64, 66, 5, 46, 20); fillSticker(x, '#ffc34d') } },
  { id: 'heart', draw: (x) => {
    x.beginPath(); x.moveTo(64, 102)
    x.bezierCurveTo(8, 60, 26, 18, 64, 46)
    x.bezierCurveTo(102, 18, 120, 60, 64, 102)
    x.closePath(); fillSticker(x, '#ff6b9d')
  } },
  { id: 'bolt', draw: (x) => {
    x.beginPath(); x.moveTo(76, 14); x.lineTo(36, 72); x.lineTo(58, 72)
    x.lineTo(50, 114); x.lineTo(94, 52); x.lineTo(70, 52)
    x.closePath(); fillSticker(x, '#ffd84a')
  } },
  { id: 'sparkle', draw: (x) => {
    const cx = 64, cy = 64, o = 50, i = 13
    const p: [number, number][] = [[0,-o],[i,-i],[o,0],[i,i],[0,o],[-i,i],[-o,0],[-i,-i]]
    x.beginPath(); p.forEach((q, idx) => idx ? x.lineTo(cx+q[0], cy+q[1]) : x.moveTo(cx+q[0], cy+q[1]))
    x.closePath(); fillSticker(x, '#5ec8d4')
  } },
  { id: 'gem', draw: (x) => {
    x.beginPath(); x.moveTo(64, 16); x.lineTo(106, 54); x.lineTo(64, 114); x.lineTo(22, 54)
    x.closePath(); fillSticker(x, '#a78bfa')
  } },
  { id: 'drop', draw: (x) => {
    x.beginPath(); x.moveTo(64, 16)
    x.bezierCurveTo(104, 68, 94, 112, 64, 112)
    x.bezierCurveTo(34, 112, 24, 68, 64, 16)
    x.closePath(); fillSticker(x, '#6bc6ff')
  } },
  { id: 'flower', draw: (x) => {
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3
      x.beginPath(); x.ellipse(64 + Math.cos(a) * 25, 64 + Math.sin(a) * 25, 19, 19, 0, 0, Math.PI * 2)
      fillSticker(x, '#ff8fb3')
    }
    x.beginPath(); x.arc(64, 64, 16, 0, Math.PI * 2); fillSticker(x, '#ffc34d')
  } },
  { id: 'moon', draw: (x) => {
    x.beginPath()
    x.arc(58, 64, 44, Math.PI * 0.5, Math.PI * 1.5, false)
    x.arc(80, 58, 42, Math.PI * 1.35, Math.PI * 0.62, true)
    x.closePath(); fillSticker(x, '#ffd27a')
  } },
]

function makeSticker(s: Sticker) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')!
  s.draw(x)
  return c
}

export function Paint() {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('brush')
  const [color, setColor] = useState('#f2a65a')
  const [brushSize, setBrushSize] = useState(3)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const sceneRef = useRef<SceneState | null>(null)

  const toolRef = useRef(tool)
  const colorRef = useRef(color)
  const sizeRef = useRef(brushSize)
  toolRef.current = tool
  colorRef.current = color
  sizeRef.current = brushSize

  useEffect(() => {
    const stage = stageRef.current!
    const canvas = canvasRef.current!
    if (!stage || !canvas) return

    ;(window as any).THREE = THREE

    const script = document.createElement('script')
    script.src = PAINT_SCRIPT
    script.onload = () => {
      const HP = (window as any).HedgyPaint
      if (!HP) { setError('paint engine failed to load'); return }

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.NoToneMapping
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x0a0b10)
      const camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.01, 50)
      camera.position.set(0, 0.4, 2.2)
      scene.add(new THREE.AmbientLight(0xffffff, 0.55))
      const sun = new THREE.DirectionalLight(0xffffff, 0.9)
      sun.position.set(3, 3, 3)
      scene.add(sun)
      const fill = new THREE.PointLight(0xa78bfa, 0.3)
      fill.position.set(-2, 1, 2)
      scene.add(fill)

      const S: SceneState = {
        renderer, scene, camera, controls: null as any, root: null, pcs: [],
        undoStack: [], sticker: makeSticker(STICKERS[0]), HP,
        painting: false, strokePointer: null, last: null, activePC: null,
        tool: 'brush', color: '#f2a65a', brushSize: 3, animId: 0
      }
      sceneRef.current = S

      function resize() {
        const w = stage.clientWidth, h = stage.clientHeight
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        renderer.setSize(w, h, false)
        renderer.setPixelRatio(dpr)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
      window.addEventListener('resize', resize)
      resize()

      const ray = new THREE.Raycaster()
      const ndc = new THREE.Vector2()

      function castAt(ev: PointerEvent) {
        if (!S.root) return null
        const r = canvas.getBoundingClientRect()
        ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1
        ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1
        ray.setFromCamera(ndc, camera)
        const hits = ray.intersectObject(S.root, true)
        for (const h of hits) if (h.uv && (h.object as any).userData.pc) return h
        return null
      }

      function snapshot(pc: any) {
        S.undoStack.push({ pc, data: pc.ctx.getImageData(0, 0, pc.can.width, pc.can.height) })
        if (S.undoStack.length > UNDO_CAP) S.undoStack.shift()
      }

      function paintAt(hit: THREE.Intersection) {
        const pc = (hit.object as any).userData.pc
        const t = toolRef.current
        if (t === 'stamp') {
          if (!S.sticker) return
          const sz = 20 + sizeRef.current * 4
          pc.ctx.drawImage(S.sticker, hit.uv!.x * pc.can.width - sz / 2, hit.uv!.y * pc.can.height - sz / 2, sz, sz)
          HP.refresh(pc)
        } else if (t === 'fill') {
          HP.faceFill(pc, hit, { color: colorRef.current, alpha: 1 })
        } else {
          S.last = HP.stroke(pc, S.last && S.activePC === pc ? S.last : null,
            hit.uv!.x, hit.uv!.y, { size: sizeRef.current, soft: 0.25, alpha: 1, color: colorRef.current })
        }
        S.activePC = pc
      }

      canvas.addEventListener('pointerdown', (ev: PointerEvent) => {
        // right-click opens a menu that swallows the pointerup, leaving the stroke stuck open
        if (ev.button !== 0) return
        // a press from the same pointer, or after capture was lost, means the previous
        // release never arrived (menu, app switch); close that stroke instead of blocking
        if (S.painting && (ev.pointerId === S.strokePointer ||
            S.strokePointer === null || !canvas.hasPointerCapture(S.strokePointer))) endStroke()
        if (toolRef.current === 'orbit' || S.painting) return
        const hit = castAt(ev)
        if (!hit) return
        S.controls.enabled = false
        S.painting = true
        S.strokePointer = ev.pointerId
        S.last = null
        canvas.setPointerCapture(ev.pointerId)
        snapshot((hit.object as any).userData.pc)
        if (toolRef.current === 'stamp') sfx.paintStamp()
        else sfx.paintStart()
        paintAt(hit)
      })
      canvas.addEventListener('pointermove', (ev: PointerEvent) => {
        if (!S.painting || ev.pointerId !== S.strokePointer) return
        if (toolRef.current === 'stamp') return
        const hit = castAt(ev)
        if (hit) paintAt(hit)
        else S.last = null
      })
      function endStroke(ev?: PointerEvent) {
        if (!S.painting || (ev && ev.pointerId !== S.strokePointer)) return
        S.painting = false
        S.strokePointer = null
        S.last = null
        S.controls.enabled = true
        sfx.paintStop()
      }
      canvas.addEventListener('pointerup', endStroke)
      canvas.addEventListener('pointercancel', endStroke)
      canvas.addEventListener('lostpointercapture', endStroke)

      const controls = new OrbitControls(camera, canvas)
      controls.enableDamping = true
      controls.enablePan = false
      controls.minDistance = 0.6
      controls.maxDistance = 6
      S.controls = controls

      new GLTFLoader().load(MODEL, (gltf) => {
        const root = gltf.scene
        S.root = root
        const box = new THREE.Box3().setFromObject(root)
        const c = box.getCenter(new THREE.Vector3())
        root.position.sub(c)
        root.rotation.y = -Math.PI / 2
        const span = box.getSize(new THREE.Vector3()).length()
        camera.position.setLength(span * 1.35)
        controls.target.set(0, 0, 0)

        root.traverse((o: any) => {
          if (!o.isMesh || !o.material) return
          o.material = o.material.clone()
          const mat = o.material as THREE.MeshStandardMaterial
          let up: HTMLCanvasElement | null = null
          if (mat.map && mat.map.image) {
            up = document.createElement('canvas')
            up.width = up.height = PAINT_RES
            const x = up.getContext('2d')!
            x.imageSmoothingEnabled = false
            x.drawImage(mat.map.image as CanvasImageSource, 0, 0, PAINT_RES, PAINT_RES)
          }
          const pc = HP.canvasFromMap(
            up ? { image: up, encoding: (mat.map as any).encoding, wrapS: mat.map!.wrapS, wrapT: mat.map!.wrapT } : null,
            PAINT_RES, PAINT_RES, '#bfb8ab')
          pc.original = pc.ctx.getImageData(0, 0, pc.can.width, pc.can.height)
          mat.map = pc.tex
          // hedgy-paint still sets the removed `encoding` field, so without this the
          // texture is read as linear and renders washed out
          pc.tex.colorSpace = THREE.SRGBColorSpace
          pc.tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
          pc.tex.needsUpdate = true
          if ('metalness' in mat) mat.metalness = 0
          if ('roughness' in mat) mat.roughness = 1
          mat.transparent = false
          mat.depthWrite = true
          if (mat.color) mat.color.set(0xffffff)
          mat.needsUpdate = true
          o.userData.pc = pc
          S.pcs.push(pc)
        })

        scene.add(root)
        setLoading(false)
      }, undefined, (err: any) => {
        setError('could not load the model')
        console.error(err)
      })

      function tick() {
        S.animId = requestAnimationFrame(tick)
        controls.update()
        renderer.render(scene, camera)
      }
      S.animId = requestAnimationFrame(tick)
    }
    script.onerror = () => setError('could not load paint engine')
    document.head.appendChild(script)

    return () => {
      sfx.paintStop()
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animId)
        sceneRef.current.renderer.dispose()
        sceneRef.current.controls.dispose()
      }
      script.remove()
    }
  }, [])

  const handleUndo = useCallback(() => {
    const S = sceneRef.current; if (!S) return
    const u = S.undoStack.pop(); if (!u) return
    u.pc.ctx.putImageData(u.data, 0, 0)
    S.HP.refresh(u.pc)
  }, [])

  const handleClear = useCallback(() => {
    const S = sceneRef.current; if (!S) return
    for (const pc of S.pcs) {
      S.undoStack.push({ pc, data: pc.ctx.getImageData(0, 0, pc.can.width, pc.can.height) })
      if (S.undoStack.length > UNDO_CAP) S.undoStack.shift()
      pc.ctx.putImageData(pc.original, 0, 0)
      S.HP.refresh(pc)
    }
  }, [])

  const selectSticker = useCallback((s: Sticker) => {
    if (sceneRef.current) sceneRef.current.sticker = makeSticker(s)
    setTool('stamp')
  }, [])

  const stickerPreviews = useMemo(() => STICKERS.map((s) => makeSticker(s).toDataURL()), [])

  return (
    <main className="wrap paint-page">
      <div className="kicker">Playable demo</div>
      <h2>Paint on a Model</h2>
      <p className="sub">
        Draw straight onto a 3D model with mouse or touch. Pick a tool, pick a colour,
        and paint. Drag the background or pick orbit to spin it. Nothing is saved; refresh to reset.
      </p>

      <div className="paint-stage" ref={stageRef}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: tool === 'orbit' ? 'grab' : 'crosshair' }} />
        {loading && !error && <div className="paint-loading">loading model...</div>}
        {error && <div className="paint-loading">{error}</div>}
      </div>

      <div className="toolbar">
        <span className="grp">
          <span className="lab">tool</span>
          {(['brush', 'fill', 'stamp', 'orbit'] as Tool[]).map(t => (
            <button key={t} className={tool === t ? 'on' : ''} onClick={() => setTool(t)}>{t === 'fill' ? 'fill face' : t}</button>
          ))}
        </span>
        <span className="grp">
          <span className="lab">size</span>
          <input type="range" min="1" max="24" value={brushSize} onChange={e => setBrushSize(+e.target.value)} />
        </span>
        <span className="grp">
          <span className="lab">colour</span>
          {SWATCHES.map(hex => (
            <button key={hex} className={'sw' + (color === hex ? ' on' : '')} style={{ background: hex }} title={hex}
              onClick={() => setColor(hex)} />
          ))}
        </span>
        <span className="grp">
          <span className="lab">sticker</span>
          {STICKERS.map((s, i) => (
            <button key={s.id} onClick={() => selectSticker(s)} aria-label={s.id}
              style={{ padding: '0.2rem 0.3rem', lineHeight: 0 }}>
              <img src={stickerPreviews[i]} alt={s.id} width={22} height={22} style={{ display: 'block' }} />
            </button>
          ))}
        </span>
        <span className="grp">
          <button onClick={handleUndo}>undo</button>
          <button onClick={handleClear}>clear</button>
        </span>
      </div>
    </main>
  )
}
