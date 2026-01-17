import { computed } from 'vue'
import { useNasaStore } from './nasaStore'
import { type ApodItem } from './nasaService'

export default function useNasaAPI() {
  const nasaStore = useNasaStore()

  /**
   * Fetches a single APOD for a specific date (YYYY-MM-DD)
   * or today's image if no date is provided.
   */
  const loadToday = async (date?: string): Promise<void> => {
    try {
      await nasaStore.fetchToday(date)
    } catch (error) {
      console.error('Error in useNasaAPI loadToday:', error)
    }
  }

  /**
   * Fetches a collection of random APOD images for a gallery view.
   */
  const loadGallery = async (count: number = 10): Promise<void> => {
    try {
      await nasaStore.fetchDailyImages(count)
    } catch (error) {
      console.error('Error in useNasaAPI loadGallery:', error)
    }
  }

  /**
   * Helper to determine the best display URL.
   * APOD provides 'url' (standard) and 'hdurl' (high-res).
   * @param forceHd - If true, prefers the high-definition source.
   */
  const getImageUrl = (item: ApodItem | null, forceHd: boolean = false): string => {
    if (!item || item.media_type !== 'image') return ''
    return forceHd && item.hdurl ? item.hdurl : item.url
  }

  /**
   * Helper for template logic to decide between <img> and <iframe>.
   * APOD often returns YouTube or Vimeo links as the 'url'.
   */
  const isVideo = (item: ApodItem | null): boolean => {
    return item?.media_type === 'video'
  }

  return {
    // Methods
    loadToday,
    loadGallery,
    getImageUrl,
    isVideo,

    // Reactive State (Computed from Store)
    today: computed(() => nasaStore.currentApod),
    gallery: computed(() => nasaStore.apods),
    isLoading: computed(() => nasaStore.isLoading),
    error: computed(() => nasaStore.error),
    hasImages: computed(() => nasaStore.hasImages),

    // Utilities
    clear: () => {
      nasaStore.apods = []
      nasaStore.error = null
    }
  }
}
