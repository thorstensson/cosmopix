<script setup lang="ts">
  import { onMounted, computed, ref } from 'vue'
  import useNasaAPI from '@/composables/useNasaAPI'
  import NasaSlideshow from '@/components/shared/NasaSlideshow.vue'
  import LineLoader from '@/components/shared/LineLoader.vue'
  import { type ApodItem } from '@/api/nasaService'

  const { loadGallery, gallery, error, isVideo } = useNasaAPI()
  const showLoader = ref(true)
  const apiLoaded = ref(false)
  const loaderAnimationComplete = ref(false)
  const isSlideshowReady = ref(false)

  const filteredItems = computed(() => {
    return gallery.value.filter((item: ApodItem) => !isVideo(item))
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
      console.log('Loading gallery with 36 images...')
      await loadGallery(36)
      apiLoaded.value = true
      checkIfShouldHideLoader()

      console.log('Gallery loaded:', {
        totalItems: gallery.value.length,
        filteredItems: filteredItems.value.length,
        sampleItem: filteredItems.value[0],
        hasImages: filteredItems.value.length > 0
      })
    } catch (err) {
      console.error('Error loading gallery:', err)
      apiLoaded.value = true
      checkIfShouldHideLoader()
    }
  })
</script>

<template>
  <div class="min-h-screen" style="background-color: #050505">
    <LineLoader
      v-if="showLoader"
      @complete="handleLoaderComplete"
      class="fixed inset-0 flex items-center justify-center z-50"
    />

    <div
      v-if="!showLoader"
      class="transition-opacity duration-1000 ease-in-out"
      :class="isSlideshowReady ? 'opacity-100' : 'opacity-0'"
    >
      <div v-if="error" class="error text-red-400 text-center p-8">Error: {{ error }}</div>

      <div v-else-if="filteredItems.length > 0">
        <NasaSlideshow :apod-items="filteredItems" @ready="handleSlideshowReady" />
      </div>

      <div v-else class="text-white text-center p-8">No images available</div>
    </div>
  </div>
</template>

<style scoped></style>
