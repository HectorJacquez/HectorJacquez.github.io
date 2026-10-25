import { useRef, useState, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { sfx } from '../sfx'
import { stepQuality, qualityOverride, type Quality } from './quality'
import { stepSpring, isSettled, type SpringState } from '../motion/spring'

const MODEL = `${import.meta.env.BASE_URL}models/CRT.glb?v=3`
const PHOTO = `${import.meta.env.BASE_URL}face.png`

// reveal timing (seconds)
const FIRST_DELAY = 5   // drawn face holds this long before the first switch
const IDLE_GAP = 5      // drawn face hold between reveals
const SPIN_DUR = 1.6    // one full 360 turn
// the TV chases the eased spin path on this spring, so it glides and settles instead of braking
const SPIN_SPRING = { stiffness: 120, damping: 16 }
const SHOW_DUR = 10     // how long the real portrait stays up

// the screen glass inside the 256x256 texture atlas (top-left tile)
const G = { x: 8, y: 9, w: 50, h: 50 }

// sparkle palette: green / purple / orange
const SPARK_COLORS = ['#9ece6a', '#a78bfa', '#f2a65a', '#e0b84a', '#7ee0b0']

const easeInOutSine = (p: number) => -(Math.cos(Math.PI * p) - 1) / 2

/** "Sharp bilinear" pixel art: each texel stays solid inside and blends only across a
 *  one-screen-pixel strip at its edges, so it reads crisp without popping as it moves. */
function sharpPixels(m: THREE.MeshStandardMaterial) {
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec2 texSize = vec2(textureSize(map, 0));
        vec2 px = vMapUv * texSize;
        vec2 seam = floor(px + 0.5);
        px = seam + clamp((px - seam) / max(fwidth(px), vec2(1e-5)), -0.5, 0.5);
        // original derivatives, so mip selection isn't thrown off by the snapped uv
        diffuseColor *= textureGrad(map, px / texSize, dFdx(vMapUv), dFdy(vMapUv));
      #endif
    `)
  }
}

/** Draw the pixel-art atlas at 4x, then composite the photo onto the screen glass
 *  with light scanlines and a gentle vignette so it reads as a picture on the CRT. */
function buildPhotoAtlas(atlas: CanvasImageSource, photo: HTMLImageElement): HTMLCanvasElement {
  const S = 4, N = 256 * S
  const c = document.createElement('canvas')
  c.width = c.height = N
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.drawImage(atlas, 0, 0, N, N)

  const gx = G.x * S, gy = G.y * S, gw = G.w * S, gh = G.h * S
  g.save()
  g.beginPath(); g.rect(gx, gy, gw, gh); g.clip()
  g.imageSmoothingEnabled = true
  const s = Math.max(gw / photo.width, gh / photo.height) // cover-fit, centered
  const pw = photo.width * s, ph = photo.height * s
  g.drawImage(photo, gx + (gw - pw) / 2, gy + (gh - ph) / 2, pw, ph)
  g.restore()
  return c
}

/** A soft round sparkle sprite (tinted per-particle via vertex colors). */
function buildSparkle(): THREE.Texture {
  const n = 64
  const c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd; g.fillRect(0, 0, n, n)
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2
  g.beginPath(); g.moveTo(n / 2, 8); g.lineTo(n / 2, n - 8)
  g.moveTo(8, n / 2); g.lineTo(n - 8, n / 2); g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Sparkles({ apiRef }: { apiRef: React.MutableRefObject<{ set: (v: number) => void } | null> }) {
  const ref = useRef<THREE.Points>(null)
  const sprite = useMemo(buildSparkle, [])
  const geo = useMemo(() => {
    const COUNT = 70
    const pos = new Float32Array(COUNT * 3)
    const col = new Float32Array(COUNT * 3)
    const col3 = new THREE.Color()
    for (let i = 0; i < COUNT; i++) {
      const u = Math.random(), v = Math.random()
      const th = u * Math.PI * 2, ph = Math.acos(2 * v - 1)
      const r = 0.55 + Math.random() * 0.8
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th)
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.95 + 0.45
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th)
      col3.set(SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0])
      col[i * 3] = col3.r; col[i * 3 + 1] = col3.g; col[i * 3 + 2] = col3.b
    }
    const bg = new THREE.BufferGeometry()
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    bg.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return bg
  }, [])

  useEffect(() => {
    apiRef.current = {
      set: (val: number) => {
        const m = ref.current?.material as THREE.PointsMaterial | undefined
        if (m) m.opacity = val
      },
    }
  }, [apiRef])

  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 1.4 })

  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial
        map={sprite} size={0.18} sizeAttenuation vertexColors transparent opacity={0}
        depthWrite={false} blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function CRTModel({ onClick, reduced }: { onClick: () => void; reduced: boolean }) {
  const gltf = useGLTF(MODEL)
  const ref = useRef<THREE.Group>(null)
  const { viewport, gl } = useThree()
  const scene = useMemo(() => gltf.scene.clone(true), [gltf])

  const mat = useRef<THREE.MeshStandardMaterial | null>(null)
  const origMap = useRef<THREE.Texture | null>(null)
  const photoMap = useRef<THREE.Texture | null>(null)
  const sparkApi = useRef<{ set: (v: number) => void } | null>(null)
  const rev = useRef({
    phase: 'idle' as 'idle' | 'spinOut' | 'show' | 'spinBack',
    start: 0, nextAt: FIRST_DELAY, swapped: false, spin: { x: 0, v: 0 } as SpringState,
  })

  useEffect(() => {
    let screenMat: THREE.MeshStandardMaterial | null = null
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone()
      const m = mesh.material as THREE.MeshStandardMaterial
      if (m.map) {
        m.map.magFilter = THREE.LinearFilter
        m.map.minFilter = THREE.LinearMipmapLinearFilter
        m.map.generateMipmaps = true
        m.map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
        m.map.needsUpdate = true
        sharpPixels(m)
        screenMat = m
      }
    })
    if (!screenMat) return
    mat.current = screenMat
    origMap.current = (screenMat as THREE.MeshStandardMaterial).map

    if (reduced) return
    const atlas = (screenMat as THREE.MeshStandardMaterial).map?.image as CanvasImageSource | undefined
    if (!atlas) return
    const img = new Image()
    img.src = PHOTO
    img.onload = () => {
      const canvas = buildPhotoAtlas(atlas, img)
      const tex = new THREE.CanvasTexture(canvas)
      tex.flipY = origMap.current!.flipY
      tex.colorSpace = THREE.SRGBColorSpace
      tex.wrapS = origMap.current!.wrapS
      tex.wrapT = origMap.current!.wrapT
      tex.magFilter = THREE.LinearFilter
      tex.minFilter = THREE.LinearMipmapLinearFilter
      tex.generateMipmaps = true
      tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
      tex.needsUpdate = true
      // upload now, not on the first swap mid-spin where it would hitch a frame
      gl.initTexture(tex)
      photoMap.current = tex
    }
  }, [scene, reduced, gl])

  useFrame((state, delta) => {
    const g = ref.current
    if (!g) return
    const t = state.clock.elapsedTime
    const bob = Math.sin(t * 0.8) * 0.06
    const sway = Math.sin(t * 0.3) * 0.06
    const r = rev.current
    let intensity = 0

    if (reduced || r.phase === 'idle' || r.phase === 'show') {
      g.rotation.x = Math.sin(t * 0.5) * 0.04
      g.rotation.y = -Math.PI / 2 + sway
      g.position.y = bob
      if (!reduced && r.phase === 'idle' && t >= r.nextAt && photoMap.current) {
        r.phase = 'spinOut'; r.start = t; r.swapped = false; r.spin = { x: 0, v: 0 }
        sfx.miniHover()
      }
      if (r.phase === 'show' && t - r.start > SHOW_DUR) {
        r.phase = 'spinBack'; r.start = t; r.swapped = false; r.spin = { x: 0, v: 0 }
        sfx.miniHover()
      }
    } else {
      const p = Math.min(1, (t - r.start) / SPIN_DUR)
      const turn = Math.PI * 2
      r.spin = stepSpring(r.spin, easeInOutSine(p) * turn, delta, SPIN_SPRING)
      intensity = Math.sin(p * Math.PI)
      g.rotation.x = Math.sin(t * 0.5) * 0.04
      // the idle sway keeps running through the spin, so the start and end don't jump
      g.rotation.y = -Math.PI / 2 + sway + r.spin.x
      g.position.y = bob + intensity * 0.05
      if (!r.swapped && r.spin.x >= Math.PI && mat.current) {
        r.swapped = true
        mat.current.map = r.phase === 'spinOut' ? photoMap.current : origMap.current
        mat.current.needsUpdate = true
      }
      if (p >= 1 && isSettled(r.spin, turn, 0.002)) {
        g.rotation.y = -Math.PI / 2 + sway
        if (r.phase === 'spinOut') { r.phase = 'show'; r.start = t }
        else { r.phase = 'idle'; r.nextAt = t + IDLE_GAP }
      }
    }

    sparkApi.current?.set(intensity)
  })

  const scale = Math.min(viewport.width * 0.28, 2.2)

  return (
    <group ref={ref} onClick={onClick} scale={scale}>
      <primitive object={scene} />
      {!reduced && <Sparkles apiRef={sparkApi} />}
    </group>
  )
}

export function CRT3D({ onActivate }: { onActivate: () => void }) {
  const [gl, setGl] = useState(true)
  const reduced = useMemo(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  }, [])
  // accept ?quality= before the hash (/?quality=0#/) or inside it (#/?quality=0)
  const forced = useMemo(() => qualityOverride(
    `${window.location.search}&${window.location.hash.split('?')[1] ?? ''}`), [])
  const [quality, setQuality] = useState<Quality>(forced ?? 2)
  const adapt = (ev: 'decline' | 'incline' | 'fallback') => {
    if (forced === null) setQuality((q) => stepQuality(q, ev))
  }

  if (!gl) return null

  return (
    <div className="crt-3d" onClick={onActivate} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onActivate() }}
      aria-label="Open the texture painter"
    >
      <Canvas
        gl={{ antialias: true, alpha: true }}
        dpr={quality === 0 ? 1 : [1, 2]}
        camera={{ position: [0, 0.3, 3.2], fov: 36 }}
        onCreated={({ gl: renderer }) => {
          renderer.setClearColor(0x000000, 0)
          renderer.toneMapping = THREE.NoToneMapping
        }}
        onError={() => setGl(false)}
      >
        <PerformanceMonitor flipflops={3}
          onDecline={() => adapt('decline')}
          onIncline={() => adapt('incline')}
          onFallback={() => adapt('fallback')} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 3, 3]} intensity={0.9} />
        <pointLight position={[-2, 1, 2]} intensity={0.3} color="#a78bfa" />
        <Suspense fallback={null}>
          <CRTModel onClick={onActivate} reduced={reduced} />
        </Suspense>
        {quality === 2 && (
          <EffectComposer>
            <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.4} intensity={0.35} mipmapBlur />
            <Vignette offset={0.3} darkness={0.55} />
          </EffectComposer>
        )}
      </Canvas>
      <span className="crt-hint">click to paint</span>
    </div>
  )
}
