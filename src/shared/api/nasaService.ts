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

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

export const getApodImage = async (
  date?: string,
  retries = 3,
  backoff = 1000
): Promise<ApodItem> => {
  const params = new URLSearchParams({
    api_key: API_KEY,
    ...(date && { date })
  })

  try {
    const response = await fetch(`${BASE_URL}?${params.toString()}`)

    // If we hit a 503 and have retries left
    if (response.status === 503 && retries > 0) {
      console.warn(`NASA 503 - Retrying in ${backoff}ms... (${retries} left)`)
      await delay(backoff)
      return getApodImage(date, retries - 1, backoff * 2) // Double the wait time
    }

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    return await response.json()
  } catch (error) {
    // If we ran out of retries or got a different error (like 403)
    console.error('Final NASA Service Error:', error)
    throw error
  }
}
