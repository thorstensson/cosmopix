import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getApodImage, type ApodItem } from '../../shared/api/nasaService'

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
    const API_KEY = import.meta.env.VITE_NASA_API_KEY
    const url = `https://api.nasa.gov/planetary/apod?api_key=${API_KEY}&count=${count}`

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 5 second timeout

    try {
      const response = await fetch(url, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const data = await response.json()
      apods.value = Array.isArray(data) ? data : [data]
    } catch (err) {
      clearTimeout(timeoutId)
      // This week NASA API been throwing 503, so added direct CDN image fallback
      // Check if it was an abort (timeout) or other error
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log(
          '%cNASA APOD API timed out, using fallback from NASA-IMAGES. NASA API throwing 503 sometimes.',
          'color: green'
        ) // Force green
      } else {
        console.error('APOD API Down, using stable fallback:', err)
      }

      // These are direct links to NASA's high-availability asset CDN
      const assetBase = '/nasa-assets/image'

      // Verified CDN IDs that load as direct JPGs
      const fallbacks = [
        { date: '2024-03-01', title: 'Earth and Moon', id: 'PIA25740' },
        { date: '2024-03-02', title: 'Jupiter Swirls', id: 'PIA21971' },
        { date: '2024-03-03', title: 'Saturn Rings', id: 'PIA17172' },
        { date: '2024-03-04', title: 'Mars Surface', id: 'PIA24462' },
        { date: '2024-03-13', title: 'Buzz on Moon', id: 'as11-40-5903' },
        { date: '2024-03-14', title: 'Blue Marble', id: 'as17-148-22727' },
        { date: '2024-03-16', title: 'Solar Flare', id: 'GSFC_20171208_Archive_e000880' },
        { date: '2024-03-18', title: 'Shuttle Discovery', id: 'KSC-99pp0492' },
        { date: '2024-03-19', title: 'Milky Way Core', id: 'PIA12348' }
      ]

      apods.value = fallbacks.map((f) => ({
        date: f.date,
        title: f.title,
        explanation: 'Archived NASA asset.',
        url: `${assetBase}/${f.id}/${f.id}~medium.jpg`,
        media_type: 'image',
        service_version: 'v1'
      }))
    } finally {
      isLoading.value = false
      // Ensure timeout is cleared
      clearTimeout(timeoutId)
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
