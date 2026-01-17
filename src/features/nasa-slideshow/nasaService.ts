export interface ApodItem {
  date: string
  title: string
  explanation: string
  url: string // Standard quality
  hdurl?: string // High quality (optional, usually present for images)
  media_type: string // 'image' or 'video'
  copyright?: string
  service_version: string
}

const BASE_URL = 'https://api.nasa.gov/planetary/apod'
const API_KEY = import.meta.env.VITE_NASA_API_KEY

export const getApodImage = async (date?: string): Promise<ApodItem> => {
  const params = new URLSearchParams({
    api_key: API_KEY,
    ...(date && { date }) // Format: YYYY-MM-DD
  })

  try {
    const response = await fetch(`${BASE_URL}?${params.toString()}`)
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    return await response.json()
  } catch (error) {
    console.error('Error fetching APOD data:', error)
    throw error
  }
}
