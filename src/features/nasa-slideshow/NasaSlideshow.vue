<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
  import { Curtains, Plane, type Texture } from 'curtainsjs'
  import { type ApodItem } from './nasaService'
  import PreviousButton from './components/PreviousButton.vue'
  import NextButton from './components/NextButton.vue'
  import NasaMetadata from './components/NasaMetadata.vue'
  const isInitialized = ref(false)
  const emit = defineEmits<{
    ready: []
  }>()

  interface Props {
    apodItems: ApodItem[]
    useHd?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    apodItems: () => [],
    useHd: false
  })

  const curtains = ref<Curtains | null>(null)
  const multiTexturesPlane = ref<Plane | null>(null)
  const currentSlideIndex = ref(0)
  const isChanging = ref(false)
  const activeTexture = ref<Plane['textures'][0] | null>(null)
  const nextTexture = ref<Plane['textures'][0] | null>(null)

  const slideshowState = ref({
    activeTextureIndex: 1,
    nextTextureIndex: 2,
    maxTextures: 0,
    isChanging: false,
    transitionTimer: 0
  })

  // Image preloading cache
  const imageCache = ref<Map<string, HTMLImageElement>>(new Map())

  // Filter out videos and GIFs, only include non-GIF images
  const imageItems = computed(() => {
    return props.apodItems.filter((item) => {
      if (item.media_type !== 'image') return false
      // Also filter out GIF images
      const url = item.url.toLowerCase()
      return !url.endsWith('.gif')
    })
  })

  const imageUrls = computed(() => {
    const urls = imageItems.value.map((item) => {
      const url = props.useHd && item.hdurl ? item.hdurl : item.url
      // Use local Vite proxy for NASA APOD images to avoid CORS issues
      if (url.includes('apod.nasa.gov')) {
        return `/apod-images${url.replace('https://apod.nasa.gov', '')}`
      }
      return url
    })

    return urls
  })

  const currentMetadata = computed(() => {
    if (imageItems.value.length > 0 && currentSlideIndex.value < imageItems.value.length) {
      return imageItems.value[currentSlideIndex.value]
    }
    return null
  })

  /**
   * Shaders from Curtains.js example
   * @https://www.curtainsjs.com/examples/multiple-textures/index.html
   */
  const vertexShader = `
    precision mediump float;

    attribute vec3 aVertexPosition;
    attribute vec2 aTextureCoord;

    uniform mat4 uMVMatrix;
    uniform mat4 uPMatrix;

    varying vec3 vVertexPosition;
    varying vec2 vTextureCoord;
    varying vec2 vActiveTextureCoord;
    varying vec2 vNextTextureCoord;

    uniform mat4 activeTexMatrix;
    uniform mat4 nextTexMatrix;

    uniform float uTransitionTimer;

    void main() {
      gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

      vTextureCoord = aTextureCoord;
      vActiveTextureCoord = (activeTexMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
      vNextTextureCoord = (nextTexMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;

      vVertexPosition = aVertexPosition;
    }
    `

  const fragmentShader = `
  precision mediump float;

  varying vec3 vVertexPosition;
  varying vec2 vTextureCoord;
  varying vec2 vActiveTextureCoord;
  varying vec2 vNextTextureCoord;

  uniform float uTransitionTimer;

  uniform sampler2D activeTex;
  uniform sampler2D nextTex;
  uniform sampler2D displacement;

  void main() {
    vec4 displacementTexture = texture2D(displacement, vTextureCoord);

    // Smooth displacement effect
    vec2 firstDisplacementCoords = vActiveTextureCoord + displacementTexture.r * ((cos((uTransitionTimer + 90.0) / (90.0 / 3.141592)) + 1.0) / 1.25);
    vec4 firstDistortedColor = texture2D(activeTex, vec2(vActiveTextureCoord.x, firstDisplacementCoords.y));

    vec2 secondDisplacementCoords = vNextTextureCoord - displacementTexture.r * ((cos(uTransitionTimer / (90.0 / 3.141592)) + 1.0) / 1.25);
    vec4 secondDistortedColor = texture2D(nextTex, vec2(vNextTextureCoord.x, secondDisplacementCoords.y));

    // Linear transition from 0.0 to 1.0 as uTransitionTimer goes from 0 to 90
    float transition = clamp(uTransitionTimer / 90.0, 0.0, 1.0);
    vec4 finalColor = mix(firstDistortedColor, secondDistortedColor, transition);

    finalColor = vec4(finalColor.rgb * finalColor.a, finalColor.a);

    gl_FragColor = finalColor;
  }
  `

  const initSlideshow = () => {
    if (isInitialized.value) return // Stop if already running
    isInitialized.value = true
    try {
      if (curtains.value) {
        curtains.value.dispose()
        curtains.value = null
      }

      const canvasContainer = document.getElementById('canvas')
      if (!canvasContainer) return

      curtains.value = new Curtains({
        container: 'canvas',
        watchScroll: false,
        pixelRatio: Math.min(1.5, window.devicePixelRatio)
      })

      curtains.value
        .onError(() => {
          document.body.classList.add('no-curtains', 'image-1')
        })
        .onContextLost(() => {
          curtains.value?.restoreContext()
        })

      curtains.value.disableDrawing()

      const params = {
        vertexShader,
        fragmentShader,
        uniforms: {
          transitionTimer: {
            name: 'uTransitionTimer',
            type: '1f',
            value: 0
          }
        }
      }

      const planeElement = document.querySelector('.multi-textures')
      if (!planeElement) return

      multiTexturesPlane.value = new Plane(curtains.value, planeElement, params)
      slideshowState.value.maxTextures = imageUrls.value.length

      multiTexturesPlane.value
        .onLoading((texture: Texture) => {
          texture.setMinFilter(curtains.value!.gl.LINEAR_MIPMAP_NEAREST)
        })
        .onReady(() => {
          const plane = multiTexturesPlane.value!

          // Ensure the displacement map is correctly assigned
          // If your displacement is the first <img> in HTML, it's textures[0]

          // 1. Set indices correctly: Image 1 is index 1, Image 2 is index 2
          slideshowState.value.activeTextureIndex = 1
          slideshowState.value.nextTextureIndex = 2

          // 2. Map the samplers to these textures
          const activeTex = plane.createTexture({
            sampler: 'activeTex',
            fromTexture: plane.textures[1]!
          })
          const nextTex = plane.createTexture({
            sampler: 'nextTex',
            fromTexture: plane.textures[2]!
          })

          activeTexture.value = activeTex
          nextTexture.value = nextTex

          // 3. FORCE the timer to 0 and re-enable drawing immediately
          if (plane.uniforms.transitionTimer) {
            plane.uniforms.transitionTimer.value = 0
          }
          curtains.value?.enableDrawing()

          // 4. Handle preloading of the first image source
          if (imageUrls.value.length > 0) {
            const activeImg = new Image()
            activeImg.crossOrigin = 'anonymous'
            activeImg.src = imageUrls.value[0]!

            activeImg.onload = () => {
              activeTexture.value?.setSource(activeImg)
              currentSlideIndex.value = 0 // Ensure Vue state matches
              emit('ready')
            }
          }
        })
        .onRender(() => {
          if (slideshowState.value.isChanging) {
            slideshowState.value.transitionTimer +=
              (90 - slideshowState.value.transitionTimer) * 0.04

            if (
              slideshowState.value.transitionTimer >= 88.5 &&
              slideshowState.value.transitionTimer !== 90
            ) {
              slideshowState.value.transitionTimer = 90
            }
          }

          if (multiTexturesPlane.value && multiTexturesPlane.value.uniforms.transitionTimer) {
            multiTexturesPlane.value.uniforms.transitionTimer.value =
              slideshowState.value.transitionTimer
          }
        })
    } catch (err) {
      console.error('Failed to initialize slideshow:', err)
    }
  }

  const startTransition = (direction: 'next' | 'prev') => {
    if (!curtains.value || !multiTexturesPlane.value || slideshowState.value.isChanging) return

    const totalSlides = imageUrls.value.length
    let nextImageIndex: number

    if (direction === 'next') {
      nextImageIndex = (currentSlideIndex.value + 1) % totalSlides
    } else {
      nextImageIndex = (currentSlideIndex.value - 1 + totalSlides) % totalSlides
    }

    if (!nextTexture.value || !imageUrls.value[nextImageIndex]) return

    const nextImageUrl = imageUrls.value[nextImageIndex]
    if (!nextImageUrl) return

    // Check cache first
    let nextImg = imageCache.value.get(nextImageUrl)

    if (!nextImg) {
      // Not in cache, load it
      nextImg = new Image()
      nextImg.crossOrigin = 'anonymous'
      nextImg.src = nextImageUrl

      nextImg.onload = () => {
        // Cache the loaded image
        imageCache.value.set(nextImageUrl, nextImg!)
        continueTransition()
      }
    } else {
      // Image is already cached, continue immediately
      continueTransition()
    }

    function continueTransition() {
      // Update the next texture with the preloaded image
      nextTexture.value!.setSource(nextImg!)

      // Update UI state
      slideshowState.value.nextTextureIndex = nextImageIndex! + 1
      currentSlideIndex.value = nextImageIndex!

      // Start the transition animation
      curtains.value?.enableDrawing()
      slideshowState.value.isChanging = true
      isChanging.value = true
      slideshowState.value.transitionTimer = 0

      // Complete the transition after animation
      setTimeout(() => {
        if (!curtains.value || !multiTexturesPlane.value) return

        curtains.value.disableDrawing()
        slideshowState.value.isChanging = false
        isChanging.value = false

        // Swap textures: current becomes next, next becomes current
        if (activeTexture.value && imageUrls.value[nextImageIndex!]) {
          const activeImageUrl = imageUrls.value[nextImageIndex!]
          if (!activeImageUrl) return

          // Check cache for active image
          let activeImg = imageCache.value.get(activeImageUrl)
          if (!activeImg) {
            activeImg = new Image()
            activeImg.crossOrigin = 'anonymous'
            activeImg.src = activeImageUrl
            activeImg.onload = () => {
              imageCache.value.set(activeImageUrl, activeImg!)
              activeTexture.value!.setSource(activeImg!)
            }
          } else {
            activeTexture.value!.setSource(activeImg)
          }
        }

        // Prepare for next transition
        slideshowState.value.activeTextureIndex = slideshowState.value.nextTextureIndex
        slideshowState.value.transitionTimer = 0

        // Preload next images in background
        preloadNextImages(nextImageIndex!)
      }, 1700)
    }
  }

  const nextSlide = () => {
    startTransition('next')
  }

  const prevSlide = () => {
    startTransition('prev')
  }

  // Preload next 2 images for smoother transitions
  const preloadNextImages = (currentIndex: number) => {
    if (imageUrls.value.length <= 1) return

    const total = imageUrls.value.length

    // Preload next 2 images (circular)
    for (let i = 1; i <= 2; i++) {
      const nextIndex = (currentIndex + i) % total
      const nextImageUrl = imageUrls.value[nextIndex]

      if (nextImageUrl && !imageCache.value.has(nextImageUrl)) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = nextImageUrl
        img.onload = () => {
          imageCache.value.set(nextImageUrl, img)
        }
      }
    }

    // Also preload previous 1 image for backward navigation
    const prevIndex = (currentIndex - 1 + total) % total
    const prevImageUrl = imageUrls.value[prevIndex]

    if (prevImageUrl && !imageCache.value.has(prevImageUrl)) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = prevImageUrl
      img.onload = () => {
        imageCache.value.set(prevImageUrl, img)
      }
    }
  }

  onMounted(async () => {
    await nextTick()
    setTimeout(() => {
      if (imageUrls.value.length > 0) {
        initSlideshow()
      }
    }, 100)
  })

  // Inside your <script setup>
  watch(
    () => currentMetadata.value,
    (newVal) => {
      if (newVal && newVal.title) {
        document.title = `${newVal.title} | APODS`
      } else {
        document.title = 'APODS - NASA Daily'
      }
    },
    { immediate: true }
  )

  watch(
    () => imageUrls.value,
    (newUrls) => {
      if (newUrls.length > 0) {
        currentSlideIndex.value = 0
        // Reset initialization flag when URLs change
        isInitialized.value = false
        setTimeout(() => {
          initSlideshow()
        }, 100)
      }
    },
    { immediate: true }
  )

  // Watch for image URL changes and re-init if images load late
  watch(
    () => imageUrls.value,
    (newUrls) => {
      if (newUrls.length > 0 && !multiTexturesPlane.value && !isInitialized.value) {
        // Small timeout ensures Vue has rendered the <img> tags to the DOM
        setTimeout(() => initSlideshow(), 100)
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    if (curtains.value) {
      curtains.value.dispose()
    }
  })
</script>

<template>
  <div class="slideshow-container fixed inset-0 h-screen w-screen overflow-hidden">
    <!-- COSMOPIX Header -->
    <div class="absolute top-4 left-4 z-40 sm:left-8">
      <h1 class="font-display text-[clamp(1.8rem,5vw,2.4rem)] font-bold text-white">APODS</h1>
      <h4 class="font-sans text-xs text-white lg:text-sm">
        NASA Photos of the Day API with Curtains.js
      </h4>
    </div>

    <!-- Centered container for image area and navigation -->
    <div class="absolute inset-0 z-10 flex items-center justify-center">
      <div class="relative h-full max-h-200 w-full max-w-200 max-sm:max-h-100 md:max-h-150">
        <!-- WebGL Canvas -->
        <div id="canvas" class="absolute inset-0 h-full w-full"></div>

        <!-- Texture Definition -->
        <div class="multi-textures pointer-events-none absolute inset-0 h-full w-full opacity-0">
          <!-- Displacement texture removed for page curl effect -->

          <!-- Only 2 image slots for active and next textures -->
          <img
            crossorigin="anonymous"
            data-curtains-texture-helper
            src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          />
          <img
            crossorigin="anonymous"
            data-curtains-texture-helper
            src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          />
        </div>

        <!-- Navigation Buttons -->
        <div class="slideshow-navigation absolute inset-0">
          <PreviousButton
            @prevSlide="prevSlide"
            :is-prev-disabled="imageUrls.length <= 1 || isChanging"
          />
          <NextButton
            @nextSlide="nextSlide"
            :is-next-disabled="imageUrls.length <= 1 || isChanging"
          />
        </div>
      </div>

      <!-- Slide Counter and Metadata (outside centered container) -->
      <div class="pointer-events-none fixed inset-0 z-30">
        <!-- Slide Counter -->
        <div
          class="bg-space-black absolute right-4 bottom-4 rounded-full text-xs text-white backdrop-blur-sm sm:right-8 sm:bottom-8 sm:text-sm md:right-8 md:bottom-8"
        >
          {{ currentSlideIndex + 1 }} / {{ imageUrls.length }}
        </div>
        <div>
          <NasaMetadata v-if="currentMetadata" :current-metadata="currentMetadata" />
        </div>
        <!-- Metadata Display -->
      </div>
    </div>
  </div>
</template>
