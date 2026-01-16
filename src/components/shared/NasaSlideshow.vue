<script setup lang="ts">
  import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
  import { Curtains, Plane, type Texture } from 'curtainsjs'
  import { type ApodItem } from '@/api/nasaService'
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

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown date'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

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
          // Added : any here
          texture.setMinFilter(curtains.value!.gl.LINEAR_MIPMAP_NEAREST)
        })
        .onReady(() => {
          const plane = multiTexturesPlane.value!
          const activeTex = plane.createTexture({
            sampler: 'activeTex',
            fromTexture: plane.textures[1] as Texture
          })
          const nextTex = plane.createTexture({
            sampler: 'nextTex',
            fromTexture: plane.textures[2] as Texture
          })

          slideshowState.value.activeTextureIndex = 1
          slideshowState.value.nextTextureIndex = 2
          activeTexture.value = activeTex
          nextTexture.value = nextTex

          // Load initial images if available
          if (imageUrls.value.length > 0 && imageUrls.value[0]) {
            const activeImg = new Image()
            activeImg.crossOrigin = 'anonymous'
            activeImg.src = imageUrls.value[0]

            activeImg.onload = () => {
              // Force the browser to decode the pixels before passing to Curtains
              activeImg
                .decode()
                .then(() => {
                  if (activeTex) {
                    activeTex.setSource(activeImg)
                    emit('ready')
                  }
                })
                .catch(() => {
                  // Fallback if decode fails
                  activeTex.setSource(activeImg)
                  emit('ready')
                })
            }
          }

          if (imageUrls.value.length > 1 && imageUrls.value[1]) {
            const nextImg = new Image()
            nextImg.crossOrigin = 'anonymous'
            nextImg.src = imageUrls.value[1]
            nextImg.onload = () => {
              nextTex.setSource(nextImg)
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
    let nextImageIndex

    if (direction === 'next') {
      nextImageIndex = (currentSlideIndex.value + 1) % totalSlides
    } else {
      nextImageIndex = (currentSlideIndex.value - 1 + totalSlides) % totalSlides
    }

    if (!nextTexture.value || !imageUrls.value[nextImageIndex]) return

    // Preload the next image before starting transition
    const nextImg = new Image()
    nextImg.crossOrigin = 'anonymous'
    const nextImageUrl = imageUrls.value[nextImageIndex]
    if (!nextImageUrl) return
    nextImg.src = nextImageUrl

    nextImg.onload = () => {
      // Update the next texture with the preloaded image
      nextTexture.value!.setSource(nextImg)

      // Update UI state
      slideshowState.value.nextTextureIndex = nextImageIndex + 1
      currentSlideIndex.value = nextImageIndex

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
        if (activeTexture.value && imageUrls.value[nextImageIndex]) {
          // Update active texture with the image that was just shown in nextTex
          const activeImg = new Image()
          activeImg.crossOrigin = 'anonymous'
          const activeImageUrl = imageUrls.value[nextImageIndex]
          if (!activeImageUrl) return
          activeImg.src = activeImageUrl
          activeImg.onload = () => {
            activeTexture.value!.setSource(activeImg)
          }
        }

        // Prepare for next transition
        slideshowState.value.activeTextureIndex = slideshowState.value.nextTextureIndex
        slideshowState.value.transitionTimer = 0
      }, 1700)
    }

    nextImg.onerror = (err) => {
      console.error('Failed to preload image:', imageUrls.value[nextImageIndex], err)
    }
  }

  const nextSlide = () => {
    startTransition('next')
  }

  const prevSlide = () => {
    startTransition('prev')
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
        document.title = `${newVal.title} | CosmoPix`
      } else {
        document.title = 'CosmoPix - NASA Daily Photos'
      }
    },
    { immediate: true }
  )

  watch(
    () => imageUrls.value,
    (newUrls) => {
      if (newUrls.length > 0) {
        currentSlideIndex.value = 0
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
      if (newUrls.length > 0 && !multiTexturesPlane.value) {
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
  <div class="slideshow-container fixed inset-0 w-screen h-screen overflow-hidden bg-black">
    <!-- COSMOPIX Header -->
    <div class="absolute top-0 left-0 z-40 p-6 sm:p-8">
      <h1
        class="text-white font-display font-bold tracking-wider text-xl sm:text-2xl md:text-3xl lg:text-6xl"
      >
        COSMOPIX
      </h1>
    </div>

    <!-- Centered container for image area and navigation -->
    <div class="absolute inset-0 flex items-center justify-center z-10">
      <div class="relative w-full max-w-200 h-full max-h-200">
        <!-- WebGL Canvas -->
        <div id="canvas" class="absolute inset-0 w-full h-full"></div>

        <!-- Texture Definition -->
        <div class="multi-textures absolute inset-0 w-full h-full pointer-events-none opacity-0">
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
          <!-- Previous Button -->
          <button
            @click="prevSlide"
            :disabled="imageUrls.length <= 1 || isChanging"
            class="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-auto bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full p-3 transition-all duration-300 disabled:opacity-30 disabled:cursor-default"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-8 w-8 text-white"
              viewBox="0 0 24 24"
              stroke="currentColor"
              fill="none"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <!-- Next Button -->
          <button
            @click="nextSlide"
            :disabled="imageUrls.length <= 1 || isChanging"
            class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-auto bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded-full p-3 transition-all duration-300 disabled:opacity-30 disabled:cursor-default"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-8 w-8 text-white"
              viewBox="0 0 24 24"
              stroke="currentColor"
              fill="none"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Slide Counter and Metadata (outside centered container) -->
      <div class="fixed inset-0 pointer-events-none z-30">
        <!-- Slide Counter -->
        <div
          class="absolute bottom-8 right-8 text-white bg-black/30 backdrop-blur-sm px-3 py-1 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm"
        >
          {{ currentSlideIndex + 1 }} / {{ imageUrls.length }}
        </div>

        <!-- Metadata Display -->
        <div
          v-if="currentMetadata"
          class="absolute bottom-8 left-8 max-w-xs text-white bg-black/30 backdrop-blur-sm p-3 sm:p-4 rounded-lg sm:max-w-sm md:max-w-md font-sans"
        >
          <h3 class="font-bold text-base sm:text-lg mb-1 sm:mb-2 truncate">
            {{ currentMetadata.title }}
          </h3>
          <div class="text-xs sm:text-sm space-y-1">
            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span class="text-gray-300">Date:</span>
              <span>{{ formatDate(currentMetadata.date) }}</span>
            </div>
            <div
              v-if="currentMetadata.copyright"
              class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2"
            >
              <span class="text-gray-300">Copyright:</span>
              <span class="truncate">{{ currentMetadata.copyright }}</span>
            </div>
            <div class="mt-2">
              <p class="text-gray-300 text-xs mb-1">Explanation:</p>
              <p class="text-xs sm:text-sm line-clamp-2 md:line-clamp-3">
                {{ currentMetadata.explanation }}
              </p>
            </div>
            <div class="mt-1 sm:mt-2 text-xs text-gray-400">
              Media type: {{ currentMetadata.media_type }} • Service version:
              {{ currentMetadata.service_version }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
