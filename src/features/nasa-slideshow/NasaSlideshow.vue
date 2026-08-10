<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
  import { Curtains, Plane, type Texture } from 'curtainsjs'
  import { type ApodItem } from '../../shared/api/nasaService'
  import PreviousButton from './components/PreviousButton.vue'
  import NextButton from './components/NextButton.vue'
  import NasaMetadata from './components/NasaMetadata.vue'
  import StarField from './components/StarField.vue'
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

  // Wall-clock length of a transition. The shader timer is a plain 0->90 ramp
  // across this window; the easing lives in the shader's cosine blend, so the
  // effect looks identical at 60Hz and 120Hz.
  const TRANSITION_DURATION_MS = 1500

  const slideshowState = ref({
    activeTextureIndex: 1,
    nextTextureIndex: 2,
    maxTextures: 0,
    isChanging: false,
    transitionTimer: 0,
    transitionStartTime: 0,
    settleFrames: 0
  })

  // Image + index handed to activeTex once the transition completes
  const pendingSlide = ref<{ img: HTMLImageElement; index: number } | null>(null)

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

     // Phase-locked to the two displacement envelopes above: each image is
     // exactly as faded as it is warped, so both morph in view. A linear ramp
     // here fades the outgoing image out faster than it distorts, which hides
     // its half of the effect entirely.
     float transition = 1.0 - ((cos(uTransitionTimer / (90.0 / 3.141592)) + 1.0) / 2.0);
     vec4 finalColor = mix(firstDistortedColor, secondDistortedColor, transition);

     finalColor = vec4(finalColor.rgb * finalColor.a, finalColor.a);

     gl_FragColor = finalColor;
   }
   `

  const initSlideshow = () => {
    currentSlideIndex.value = 0
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

      //curtains.value.disableDrawing()

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

          // 2. Use the plane's own textures directly.
          //    createTexture({ fromTexture }) returns a *copy*, and
          //    Texture.copy() assigns `_sampler.texture` by reference — the two
          //    samplers would then share one GL texture object, so uploading to
          //    nextTex would clobber activeTex mid-transition.
          activeTexture.value = plane.textures[1]!
          nextTexture.value = plane.textures[2]!

          //    Same trap on every later setSource(): both textures sit in the
          //    renderer cache, so once nextTex holds image N, handing N to
          //    activeTex finds nextTex by matching src and copies it — sharing
          //    the GL texture again. Opt both out of the cache entirely; they
          //    are only ever written to by hand. `_useCache` has no public
          //    option, hence Object.assign.
          Object.assign(activeTexture.value, { _useCache: false })
          Object.assign(nextTexture.value, { _useCache: false })

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
              // Second try after delay
              setTimeout(() => {
                activeTexture.value?.setSource(activeImg)
              }, 100)
              currentSlideIndex.value = 0 // Ensure Vue state matches
              emit('ready')
            }
          }
        })
        .onRender(() => {
          const plane = multiTexturesPlane.value
          if (!plane) return

          const state = slideshowState.value

          if (state.isChanging) {
            const elapsed = performance.now() - state.transitionStartTime
            state.transitionTimer = Math.min(elapsed / TRANSITION_DURATION_MS, 1) * 90

            if (state.transitionTimer === 90) {
              // The timer is parked at 90, so the canvas is showing nextTex.
              // Point activeTex at the same image and let it upload for a
              // couple of frames before resetting the timer, so the handover
              // is invisible instead of a hard cut.
              const pending = pendingSlide.value
              if (pending) {
                activeTexture.value?.setSource(pending.img)
                currentSlideIndex.value = pending.index
                preloadNextImages(pending.index)
                pendingSlide.value = null
              }
              state.isChanging = false
              state.settleFrames = 2
            }
          } else if (state.settleFrames > 0) {
            state.settleFrames--
            if (state.settleFrames === 0) {
              state.transitionTimer = 0
              isChanging.value = false
              curtains.value?.disableDrawing()
            }
          }

          if (plane.uniforms.transitionTimer) {
            plane.uniforms.transitionTimer.value = state.transitionTimer
          }
        })
    } catch (err) {
      console.error('Failed to initialize slideshow:', err)
    }
  }

  const startTransition = (direction: 'next' | 'prev') => {
    if (!curtains.value || !multiTexturesPlane.value || isChanging.value) return

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

    // Lock now, not in continueTransition: an uncached image leaves a load
    // window during which a second click would start a competing transition.
    isChanging.value = true

    // Check cache first
    let nextImg = imageCache.value.get(nextImageUrl)

    if (!nextImg) {
      // Not in cache, load it
      nextImg = new Image()
      nextImg.crossOrigin = 'anonymous'

      nextImg.onload = () => {
        // Cache the loaded image
        imageCache.value.set(nextImageUrl, nextImg!)
        continueTransition()
      }
      nextImg.onerror = () => {
        // Release the lock, otherwise navigation stays dead
        isChanging.value = false
      }

      nextImg.src = nextImageUrl
    } else {
      // Image is already cached, continue immediately
      continueTransition()
    }

    function continueTransition() {
      if (!curtains.value || !nextTexture.value) {
        isChanging.value = false
        return
      }

      // 1. Prepare next texture and queue the handover done in onRender
      nextTexture.value.setSource(nextImg!)
      pendingSlide.value = { img: nextImg!, index: nextImageIndex }

      // 2. Start animation. onRender drives the timer off wall-clock time and
      //    finishes the swap itself, so there is no duration to keep in sync.
      slideshowState.value.transitionTimer = 0
      slideshowState.value.transitionStartTime = performance.now()
      slideshowState.value.settleFrames = 0
      slideshowState.value.isChanging = true
      curtains.value.enableDrawing()
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
    // Add keyboard navigation for arrow keys
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle arrow keys
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (!isChanging.value && imageUrls.value.length > 1) {
          nextSlide()
        }
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (!isChanging.value && imageUrls.value.length > 1) {
          prevSlide()
        }
      }
    }

    // Add event listener
    window.addEventListener('keydown', handleKeyDown)

    // Store the handler for cleanup
    const cleanup = () => {
      window.removeEventListener('keydown', handleKeyDown)
    }

    // Clean up on unmount
    onUnmounted(() => {
      cleanup()
      if (curtains.value) {
        curtains.value.dispose()
      }
    })
  })

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
        }, 1500)
      }
    },
    { immediate: true }
  )
</script>

<template>
  <div class="slideshow-container fixed inset-0 h-dvh w-screen overflow-hidden">
    <!-- Starfield Background -->
    <StarField class="absolute inset-0 z-0" />

    <!-- Header Container -->
    <div
      class="text-gray absolute top-4 right-4 left-4 z-40 flex items-center justify-between sm:right-8 sm:left-8"
    >
      <!-- COSMOPIX Header -->
      <div>
        <h1 class="font-display text-[clamp(1.4rem,5vw,1.8rem)] font-bold">APODS</h1>
        <h4 class="font-sans text-xs lg:text-sm">NASA Photos of the Day</h4>
      </div>

      <div class="text-sm">
        <span class="mr-1 text-gray-200">by</span
        ><a
          href="https://www.thomasthorstensson.com"
          target="_blank"
          class="text-gray-400 transition-colors duration-200 hover:text-gray-100"
          title="Folio"
          >Thomas</a
        >
      </div>
    </div>

    <!-- Centered container for image area and navigation -->
    <div class="absolute inset-0 z-10 flex items-center justify-center">
      <div class="relative h-full max-h-200 w-full max-w-200 max-sm:max-h-100 md:max-h-150">
        <!-- WebGL Canvas -->
        <div id="canvas" class="absolute inset-0 h-full w-full"></div>

        <!-- Texture Definition -->
        <div class="multi-textures pointer-events-none absolute inset-0 h-full w-full opacity-0">
          <!-- Displacement texture removed for page curl effect -->

          <!-- Only 2 image slots for active and next textures.

               The two placeholders MUST have different src values. curtains
               caches textures by source.src (CacheManager.getTextureFromSource),
               and a cache hit makes the second texture a copy that shares the
               first one's GL texture object — so writing the incoming image to
               nextTex would also overwrite activeTex and the outgoing image
               would vanish before the transition's first frame. Both are 1x1
               GIFs; only the bytes differ. -->
          <img
            crossorigin="anonymous"
            data-sampler="displacement"
            data-curtains-texture-helper
            src="/src/assets/img/displacemap-2.jpg"
          />
          <img
            crossorigin="anonymous"
            data-sampler="activeTex"
            data-curtains-texture-helper
            src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          />
          <img
            crossorigin="anonymous"
            data-sampler="nextTex"
            data-curtains-texture-helper
            src="data:image/gif;base64,R0lGODlhAQABAIABAAAAAP///yH5BAEAAAABACwAAAAAAQABAAACAkQBADs="
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
          class="absolute right-4 bottom-4 rounded-full text-xs text-white mix-blend-difference sm:right-8 sm:bottom-8 sm:text-sm"
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

<style scoped>
  #canvas {
    width: 100%;
    height: 100vh;
    position: fixed; /* Common for full-page effects */
    top: 0;
    left: 0;
  }
</style>
