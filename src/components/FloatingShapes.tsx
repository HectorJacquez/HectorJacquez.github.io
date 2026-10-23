import { Canvas } from '@react-three/fiber'
import { Float, MeshTransmissionMaterial } from '@react-three/drei'
import { Suspense, lazy, useState, useEffect } from 'react'

function Shape({ geo, position, scale, speed, floatIntensity, rotationIntensity }: {
  geo: 'dodecahedron' | 'icosahedron' | 'octahedron'
  position: [number, number, number]
  scale: number
  speed: number
  floatIntensity: number
  rotationIntensity: number
}) {
  const Geo = {
    dodecahedron: <dodecahedronGeometry args={[1, 0]} />,
    icosahedron: <icosahedronGeometry args={[1, 0]} />,
    octahedron: <octahedronGeometry args={[1, 0]} />,
  }[geo]

  return (
    <Float speed={speed} floatIntensity={floatIntensity} rotationIntensity={rotationIntensity}>
      <mesh position={position} scale={scale}>
        {Geo}
        <meshStandardMaterial
          color="#a78bfa"
          roughness={0.25}
          metalness={0.6}
          transparent
          opacity={0.35}
          wireframe
        />
      </mesh>
    </Float>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={0.6} color="#a78bfa" />
      <pointLight position={[-5, -3, 3]} intensity={0.3} color="#5ec8d4" />
      <Shape geo="dodecahedron" position={[-3.5, 0.5, -1]} scale={0.7} speed={1.2} floatIntensity={1.5} rotationIntensity={0.8} />
      <Shape geo="icosahedron" position={[3.8, -0.3, -2]} scale={0.5} speed={0.8} floatIntensity={1.2} rotationIntensity={1.0} />
      <Shape geo="octahedron" position={[0, 1.2, -1.5]} scale={0.4} speed={1.5} floatIntensity={2.0} rotationIntensity={0.6} />
      <Shape geo="dodecahedron" position={[-1.5, -1.0, -3]} scale={0.3} speed={1.0} floatIntensity={1.8} rotationIntensity={1.2} />
      <Shape geo="icosahedron" position={[2.0, 1.5, -2.5]} scale={0.35} speed={1.3} floatIntensity={1.0} rotationIntensity={0.9} />
    </>
  )
}

export function FloatingShapes() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return
    setVisible(true)
  }, [])

  if (!visible) return null

  return (
    <div className="floating-shapes" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 40 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ pointerEvents: 'none' }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  )
}
