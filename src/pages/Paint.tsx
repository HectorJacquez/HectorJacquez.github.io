import { useRef, useState, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const MODEL = `${import.meta.env.BASE_URL}models/CRT.glb?v=3`
const PAINT_SCRIPT = `${import.meta.env.BASE_URL}play/paint/hedgy-paint.js`
const PAINT_RES = 512
const UNDO_CAP = 20
const SWATCHES = ['#f2a65a', '#e0533d', '#e58fb1', '#9ece6a', '#4ec9b0',
  '#7aa2f7', '#9a6fd0', '#f2efe8', '#8a5a3b', '#1b1b1f']
const STICKER_CHARS = ['🐱', '🍄', '⭐', '❤️', '🎵', '🔥', '👾', '😎']

type Tool = 'brush' | 'fill' | 'stamp' | 'orbit'
interface PaintCanvas { can: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; view: HTMLCanvasElement; original: ImageData; stencil: null }

function makeSticker(ch: string) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')!
  x.textAlign = 'center'; x.textBaseline = 'middle'
  x.font = '104px sans-serif'
  x.fillText(ch, 64, 72)
  return c
}

export function Paint() {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('brush')
  const [color, setColor] = useState('#f2a65a')
  const [brushSize, setBrushSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera
    controls: OrbitControls; root: THREE.Object3D | null; pcs: PaintCanvas[]
    undoStack: { pc: PaintCanvas; data: ImageData }[]; sticker: HTMLCanvasElement
    HP: any; painting: boolean; strokePointer: number | null; last: any; activePC: PaintCanvas | null
    tool: Tool; color: string; brushSize: number; animId: number
  } | null>(null)

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
      scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3630, 0.5))
      const sun = new THREE.DirectionalLight(0xffffff, 0.7)
      sun.position.set(2, 3, 2)
      scene.add(sun)

      const S = sceneRef.current = {
        renderer, scene, camera, controls: null!, root: null, pcs: [],
        undoStack: [], sticker: makeSticker('🐱'), HP,
        painting: false, strokePointer: null, last: null, activePC: null,
        tool: 'brush', color: '#f2a65a', brushSize: 20, animId: 0
      }

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

      function snapshot(pc: PaintCanvas) {
        S.undoStack.push({ pc, data: pc.ctx.getImageData(0, 0, pc.can.width, pc.can.height) })
        if (S.undoStack.length > UNDO_CAP) S.undoStack.shift()
      }

      function paintAt(hit: THREE.Intersection) {
        const pc = (hit.object as any).userData.pc as PaintCanvas
        const t = toolRef.current
        if (t === 'stamp') {
          if (!S.sticker) return
          const sz = sizeRef.current * 3
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
        if (toolRef.current === 'orbit' || S.painting) return
        const hit = castAt(ev)
        if (!hit) return
        S.controls.enabled = false
        S.painting = true
        S.strokePointer = ev.pointerId
        S.last = null
        canvas.setPointerCapture(ev.pointerId)
        snapshot((hit.object as any).userData.pc)
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
      }
      canvas.addEventListener('pointerup', endStroke)
      canvas.addEventListener('pointercancel', endStroke)

      const controls = new OrbitControls(camera, canvas)
      controls.enableDamping = true
      controls.enablePan = false
      controls.minDistance = 0.6
      controls.maxDistance = 6
      S.controls = controls

      new GLTFLoader().load(MODEL, (gltf) => {
        S.root = gltf.scene
        const box = new THREE.Box3().setFromObject(S.root)
        const c = box.getCenter(new THREE.Vector3())
        S.root.position.sub(c)
        S.root.rotation.y = -Math.PI / 2
        const span = box.getSize(new THREE.Vector3()).length()
        camera.position.setLength(span * 1.35)
        controls.target.set(0, 0, 0)

        S.root.traverse((o: any) => {
          if (!o.isMesh || !o.material) return
          o.material = o.material.clone()
          const mat = o.material as THREE.MeshStandardMaterial
          let up: HTMLCanvasElement | null = null
          if (mat.map && mat.map.image) {
            up = document.createElement('canvas')
            up.width = up.height = PAINT_RES
            const x = up.getContext('2d')!
            x.imageSmoothingEnabled = false
            x.drawImage(mat.map.image, 0, 0, PAINT_RES, PAINT_RES)
          }
          const pc = HP.canvasFromMap(
            up ? { image: up, encoding: (mat.map as any).encoding, wrapS: mat.map!.wrapS, wrapT: mat.map!.wrapT } : null,
            PAINT_RES, PAINT_RES, '#bfb8ab')
          pc.original = pc.ctx.getImageData(0, 0, pc.can.width, pc.can.height)
          mat.map = pc.tex
          if ('metalness' in mat) mat.metalness = 0
          if ('roughness' in mat) mat.roughness = 1
          mat.transparent = false
          mat.depthWrite = true
          if (mat.color) mat.color.set(0xffffff)
          mat.needsUpdate = true
          o.userData.pc = pc
          S.pcs.push(pc)
        })

        scene.add(S.root)
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

  const selectSticker = useCallback((ch: string) => {
    if (sceneRef.current) sceneRef.current.sticker = makeSticker(ch)
    setTool('stamp')
  }, [])

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
          <input type="range" min="4" max="64" value={brushSize} onChange={e => setBrushSize(+e.target.value)} />
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
          {STICKER_CHARS.map(ch => (
            <button key={ch} onClick={() => selectSticker(ch)}
              style={{ fontSize: '1.15rem', lineHeight: '1', padding: '0.2rem 0.5rem' }}>{ch}</button>
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
