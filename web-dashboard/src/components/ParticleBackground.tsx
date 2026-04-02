import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Particle network background — evokes AI/neural connections.
 * Renders connected nodes that slowly drift, with lines 
 * appearing between nearby particles. Subtle, premium, non-distracting.
 */
export default function ParticleBackground() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mountRef.current) return

    const container = mountRef.current
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 50

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x06080f, 1)
    container.appendChild(renderer.domElement)

    // ── Particles ──
    const PARTICLE_COUNT = 120
    const SPREAD = 80
    const CONNECTION_DISTANCE = 15

    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const velocities: THREE.Vector3[] = []

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * SPREAD
      positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30

      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.01
      ))
    }

    // Particle nodes
    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const particleMaterial = new THREE.PointsMaterial({
      color: 0x6366f1,
      size: 0.6,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    })

    const particles = new THREE.Points(particleGeometry, particleMaterial)
    scene.add(particles)

    // Connection lines
    const lineGeometry = new THREE.BufferGeometry()
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
    })
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial)
    scene.add(lines)

    // Accent glow particles (fewer, brighter)
    const glowCount = 15
    const glowPositions = new Float32Array(glowCount * 3)
    for (let i = 0; i < glowCount; i++) {
      glowPositions[i * 3] = (Math.random() - 0.5) * SPREAD
      glowPositions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD
      glowPositions[i * 3 + 2] = (Math.random() - 0.5) * 20
    }

    const glowGeometry = new THREE.BufferGeometry()
    glowGeometry.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3))

    const glowMaterial = new THREE.PointsMaterial({
      color: 0x8b5cf6,
      size: 1.5,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
    })

    const glowParticles = new THREE.Points(glowGeometry, glowMaterial)
    scene.add(glowParticles)

    // Mouse interaction
    const mouse = new THREE.Vector2(0, 0)
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', handleMouseMove)

    // ── Animation ──
    let animationId: number

    const animate = () => {
      animationId = requestAnimationFrame(animate)

      const posArray = particleGeometry.attributes.position.array as Float32Array

      // Update particle positions
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        posArray[i * 3] += velocities[i].x
        posArray[i * 3 + 1] += velocities[i].y
        posArray[i * 3 + 2] += velocities[i].z

        // Wrap around
        const halfSpread = SPREAD / 2
        if (posArray[i * 3] > halfSpread) posArray[i * 3] = -halfSpread
        if (posArray[i * 3] < -halfSpread) posArray[i * 3] = halfSpread
        if (posArray[i * 3 + 1] > halfSpread) posArray[i * 3 + 1] = -halfSpread
        if (posArray[i * 3 + 1] < -halfSpread) posArray[i * 3 + 1] = halfSpread
      }
      particleGeometry.attributes.position.needsUpdate = true

      // Update connections
      const linePositions: number[] = []
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        for (let j = i + 1; j < PARTICLE_COUNT; j++) {
          const dx = posArray[i * 3] - posArray[j * 3]
          const dy = posArray[i * 3 + 1] - posArray[j * 3 + 1]
          const dz = posArray[i * 3 + 2] - posArray[j * 3 + 2]
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

          if (dist < CONNECTION_DISTANCE) {
            linePositions.push(
              posArray[i * 3], posArray[i * 3 + 1], posArray[i * 3 + 2],
              posArray[j * 3], posArray[j * 3 + 1], posArray[j * 3 + 2]
            )
          }
        }
      }

      lineGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(linePositions, 3)
      )

      // Subtle camera movement based on mouse
      camera.position.x += (mouse.x * 3 - camera.position.x) * 0.01
      camera.position.y += (mouse.y * 3 - camera.position.y) * 0.01
      camera.lookAt(scene.position)

      // Rotate glow particles slowly
      glowParticles.rotation.y += 0.001
      glowParticles.rotation.x += 0.0005

      renderer.render(scene, camera)
    }

    animate()

    // Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      container.removeChild(renderer.domElement)
      particleGeometry.dispose()
      particleMaterial.dispose()
      lineGeometry.dispose()
      lineMaterial.dispose()
      glowGeometry.dispose()
      glowMaterial.dispose()
      renderer.dispose()
    }
  }, [])

  return <div ref={mountRef} className="three-canvas" />
}
