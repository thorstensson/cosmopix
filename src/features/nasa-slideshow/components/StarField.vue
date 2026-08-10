<script setup lang="ts">
  import { onMounted, onUnmounted, ref } from 'vue'
  import * as THREE from 'three'

  const canvasRef = ref<HTMLCanvasElement | null>(null)

  const STAR_COUNT = 600
  const SPREAD = 5 // world units across X/Y
  const DEPTH = 2.5 // world units across Z
  const TWINKLE_RATIO = 0.1 // fraction of stars that flicker

  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let points: THREE.Points | null = null
  let spriteTexture: THREE.CanvasTexture | null = null
  let animationId = 0
  let resizeObserver: ResizeObserver | null = null

  // Normalized mouse (-1..1), lerped toward target each frame for smoothness
  const mouse = { x: 0, y: 0 }
  const target = { x: 0, y: 0 }

  const vertexShader = `
    attribute float aPhase;
    attribute float aSpeed;
    attribute float aTwinkle;
    attribute float aIntensity;

    uniform float uTime;
    uniform float uSize;
    uniform float uPixelScale;

    varying float vBrightness;

    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

      // Same size attenuation three.js applies to PointsMaterial
      gl_PointSize = uSize * (uPixelScale / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;

      // Twinkle dips brightness, never raises it: aTwinkle 0 stays fixed.
      // 1 - a * (0.5 - 0.5*sin) ranges 1.0 -> 1-a -> 1.0
      float twinkle = 1.0 - aTwinkle * (0.5 - 0.5 * sin(uTime * aSpeed + aPhase));
      vBrightness = aIntensity * twinkle;
    }
  `

  const fragmentShader = `
    uniform sampler2D uMap;

    varying float vBrightness;

    void main() {
      vec4 texColor = texture2D(uMap, gl_PointCoord);
      // Soft radial sprite tinted by per-star brightness (additive blending
      // handles the rest of the glow accumulation)
      gl_FragColor = vec4(vec3(vBrightness) * texColor.rgb, texColor.a);
    }
  `

  const init = () => {
    const canvas = canvasRef.value
    if (!canvas) return

    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
    camera.position.z = 1

    const positions = new Float32Array(STAR_COUNT * 3)
    const phases = new Float32Array(STAR_COUNT)
    const speeds = new Float32Array(STAR_COUNT)
    const twinkles = new Float32Array(STAR_COUNT)
    const intensities = new Float32Array(STAR_COUNT)

    for (let i = 0; i < STAR_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * SPREAD
      positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD
      positions[i * 3 + 2] = (Math.random() - 0.5) * DEPTH

      // Power-law-ish brightness: most stars faint, few bright -> depth.
      // pow(rand, 3) hugs 0, so the field is mostly dim with white-hot leaders.
      intensities[i] = 0.15 + 0.85 * Math.pow(Math.random(), 3)
    }

    // Sparse twinkle: pick only the brightest stars, so the dip is visible.
    // A 50-80% dip on a dim star would be invisible; on a bright one it pops.
    const twinkleCount = Math.max(1, Math.round(STAR_COUNT * TWINKLE_RATIO))
    const brightest = Array.from({ length: STAR_COUNT }, (_, i) => i).sort(
      (a, b) => intensities[b]! - intensities[a]!
    )
    const twinkleSet = new Set(brightest.slice(0, twinkleCount))

    for (let i = 0; i < STAR_COUNT; i++) {
      if (twinkleSet.has(i)) {
        phases[i] = Math.random() * Math.PI * 2
        speeds[i] = 1.0 + Math.random() * 2.0
        twinkles[i] = 0.5 + Math.random() * 0.3
      } else {
        phases[i] = 0
        speeds[i] = 0
        twinkles[i] = 0
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    geometry.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles, 1))
    geometry.setAttribute('aIntensity', new THREE.BufferAttribute(intensities, 1))

    // Radial gradient sprite: white core -> transparent edge, so each point
    // renders as a soft glowing dot instead of a hard square
    const sprite = document.createElement('canvas')
    sprite.width = 32
    sprite.height = 32
    const ctx = sprite.getContext('2d')!
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.5)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 32, 32)
    spriteTexture = new THREE.CanvasTexture(sprite)

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 0.012 },
        uPixelScale: { value: canvas.height * 0.5 },
        uMap: { value: spriteTexture }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })

    points = new THREE.Points(geometry, material)
    scene.add(points)

    // Fit canvas to its container (handles the max-h/max-w layout in the parent)
    const parent = canvas.parentElement
    if (parent) {
      const fit = () => {
        const rect = parent.getBoundingClientRect()
        renderer?.setSize(rect.width, rect.height, false)
        if (camera) camera.aspect = rect.width / rect.height
        camera?.updateProjectionMatrix()
        // drawing buffer height = css height * pixelRatio
        material.uniforms.uPixelScale!.value = renderer!.domElement.height * 0.5
      }
      fit()
      resizeObserver = new ResizeObserver(fit)
      resizeObserver.observe(parent)
    }

    animate()
  }

  const animate = () => {
    animationId = requestAnimationFrame(animate)
    if (!renderer || !scene || !camera || !points) return

    // Ease mouse toward the target for a smooth parallax
    target.x += (mouse.x - target.x) * 0.04
    target.y += (mouse.y - target.y) * 0.04

    camera.position.x = target.x * 0.35
    camera.position.y = target.y * 0.35
    camera.lookAt(0, 0, 0)

    // Slow drift so the sky feels alive
    points.rotation.y += 0.00012
    ;(points.material as THREE.ShaderMaterial).uniforms.uTime!.value = performance.now() * 0.001

    renderer.render(scene, camera)
  }

  const handlePointerMove = (event: PointerEvent) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -((event.clientY / window.innerHeight) * 2 - 1)
  }

  onMounted(() => {
    init()
    window.addEventListener('pointermove', handlePointerMove)
  })

  onUnmounted(() => {
    cancelAnimationFrame(animationId)
    window.removeEventListener('pointermove', handlePointerMove)
    resizeObserver?.disconnect()
    resizeObserver = null
    // Dispose GL resources
    points?.geometry.dispose()
    ;(points?.material as THREE.Material | undefined)?.dispose()
    spriteTexture?.dispose()
    renderer?.dispose()
    renderer = null
    scene = null
    camera = null
    points = null
    spriteTexture = null
  })
</script>

<template>
  <canvas
    ref="canvasRef"
    class="pointer-events-none absolute inset-0 h-full w-full opacity-99"
    aria-hidden="true"
  ></canvas>
</template>
