import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getApodImage, type ApodItem } from './nasaService'

export const useNasaStore = defineStore('nasa', () => {
  // --- STATE ---
  const apods = ref<ApodItem[]>([]) // For gallery/list views
  const currentApod = ref<ApodItem | null>(null) // For the featured daily view
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // --- GETTERS ---
  const hasImages = computed(() => apods.value.length > 0)
  const totalImages = computed(() => apods.value.length)

  // --- ACTIONS ---

  /**
   * Fetches the image for a specific date (defaults to today).
   * Note: APOD returns a single Object for a specific date.
   */
  async function fetchToday(date?: string) {
    isLoading.value = true
    error.value = null
    try {
      currentApod.value = await getApodImage(date)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch daily image'
      console.error('Error in fetchToday:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetches multiple random images for a gallery view.
   * Note: When 'count' is used, the API returns an Array.
   */
  async function fetchDailyImages(count: number = 10) {
    isLoading.value = true
    error.value = null

    // Constructing the request directly to handle the 'count' parameter
    const API_KEY = import.meta.env.VITE_NASA_API_KEY
    const url = `https://api.nasa.gov/planetary/apod?api_key=${API_KEY}&count=${count}`

    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      const data = await response.json()
      // APOD returns an array when using 'count' or 'start_date'
      apods.value = Array.isArray(data) ? data : [data]
    } catch (err) {
      error.value = 'Failed to fetch gallery images'
      console.error('Error in fetchDailyImages:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Clears the store state
   */
  function clear() {
    apods.value = []
    currentApod.value = null
    error.value = null
  }

  return {
    // State
    apods,
    currentApod,
    isLoading,
    error,

    // Getters
    hasImages,
    totalImages,

    // Actions
    fetchToday,
    fetchDailyImages,
    clear
  }
})
