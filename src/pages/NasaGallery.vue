<script setup lang="ts">
  import { onMounted, computed, ref } from 'vue'
  import { useHead } from '@unhead/vue'
  import useNasaAPI from '@/features/nasa-slideshow/useNasaAPI'
  import NasaSlideshow from '@/features/nasa-slideshow/NasaSlideshow.vue'
  import LineLoader from '@/shared/ui/LineLoader.vue'
  import { type ApodItem } from '@/shared/api/nasaService'

  const title = 'NASA APODS | Thomas Thorstensson'
  const description =
    "A cinematic WebGL slideshow exploring NASA's Astronomy Picture of the Day archive with Curtains.js transitions."
  const url = 'https://nasa-apods.vercel.app/'

  useHead({
    title,
    meta: [
      { name: 'description', content: description },
      // Open Graph
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: '/og-image.jpg' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      // Twitter Card
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: '/og-image.jpg' }
    ],
    link: [{ rel: 'canonical', href: url }]
  })

  const { loadGallery, gallery, error, isVideo } = useNasaAPI()
  const showLoader = ref(true)
  const apiLoaded = ref(false)
  const loaderAnimationComplete = ref(false)
  const isSlideshowReady = ref(false)

  const filteredItems = computed(() => {
    return gallery.value.filter((item: ApodItem) => {
      if (isVideo(item)) return false
      // Also filter out GIF images
      if (item.media_type === 'image') {
        const url = item.url.toLowerCase()
        return !url.endsWith('.gif')
      }
      return true
    })
  })

  const handleLoaderComplete = () => {
    loaderAnimationComplete.value = true
    checkIfShouldHideLoader()
  }

  const checkIfShouldHideLoader = () => {
    if (loaderAnimationComplete.value && apiLoaded.value) {
      showLoader.value = false
    }
  }

  const handleSlideshowReady = () => {
    isSlideshowReady.value = true
  }

  onMounted(async () => {
    try {
      await loadGallery(20)
      apiLoaded.value = true
      checkIfShouldHideLoader()
    } catch (err) {
      console.error('Error loading gallery:', err)
      apiLoaded.value = true
      checkIfShouldHideLoader()
    }
  })
</script>

<template>
  <div class="bg-space-black min-h-screen">
    <LineLoader
      v-if="showLoader"
      @complete="handleLoaderComplete"
      class="fixed inset-0 z-50 flex items-center justify-center"
    />

    <div
      v-if="!showLoader"
      class="transition-opacity duration-1000 ease-in-out"
      :class="isSlideshowReady ? 'opacity-100' : 'opacity-0'"
    >
      <div v-if="error" class="error p-8 text-center text-red-400">Error: {{ error }}</div>

      <div v-else-if="filteredItems.length > 0">
        <NasaSlideshow :apod-items="filteredItems" @ready="handleSlideshowReady" />
      </div>

      <div v-else class="p-8 text-center text-white">No images available</div>
    </div>
  </div>
</template>
