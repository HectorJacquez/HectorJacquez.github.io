import { useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const MODEL = `${import.meta.env.BASE_URL}models/CRT.glb`

function CRTModel({ onClick }: { onClick: () => void }) {
  const gltf = useGLTF(MODEL)
  const ref = useRef<THREE.Group>(null)
  const { viewport } = useThree()

  useEffect(() => {
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const mat = mesh.material as THREE.MeshStandardMaterial
        if (mat.map) {
          mat.map.magFilter = THREE.NearestFilter
          mat.map.minFilter = THREE.NearestFilter
          mat.map.needsUpdate = true
        }
      }
    })
  }, [gltf])

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.3
    ref.current.position.y = Math.sin(Date.now() * 0.001) * 0.08
  })

  const scale = Math.min(viewport.width * 0.28, 2.2)

  return (
    <group ref={ref} onClick={onClick} scale={scale}>
      <primitive object={gltf.scene.clone()} />
    </group>
  )
}

export function CRT3D({ onActivate }: { onActivate: () => void }) {
  const [gl, setGl] = useState(true)

  if (!gl) return null

  return (
    <div className="crt-3d" onClick={onActivate} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onActivate() }}
      aria-label="Power on the CRT to play the game"
    >
      <Canvas
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 0.5, 3.5], fov: 40 }}
        onCreated={({ gl: renderer }) => {
          renderer.setClearColor(0x000000, 0)
        }}
        onError={() => setGl(false)}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[3, 3, 3]} intensity={1.2} />
        <pointLight position={[-2, 1, 2]} intensity={0.4} color="#a78bfa" />
        <Suspense fallback={null}>
          <CRTModel onClick={onActivate} />
        </Suspense>
      </Canvas>
      <span className="crt-hint">click to play</span>
    </div>
  )
}
