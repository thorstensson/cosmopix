# Cosmopix

A cinematic WebGL slideshow for NASA's Astronomy Picture of the Day (APOD) archive. This took some coffe to get right :coffee: :coffee: :coffee:

## Features

- **WebGL Slideshow**: Smooth transitions using Curtains.js
- **NASA APOD Integration**: Fetches images from the NASA Astronomy Picture of the Day (APOD) archive.
- **Sci-Fi**: Matrix-style loader with Orbitron typography

## Tech Stack

- **Vue 3** with TypeScript
- **Curtains.js** for WebGL transitions
- **Tailwind CSS** for styling
- **Pinia** for state management
- **NASA APOD API** for imagery

## Setup

1. Get a NASA API key from [api.nasa.gov](https://api.nasa.gov)
2. Clone the repository
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create `.env` file:
   ```env
   VITE_NASA_API_KEY=your_api_key_here
   ```
5. Run development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
cosmopix/
├── src/
│   ├── components/shared/     # Reusable components
│   │   ├── NasaSlideshow.vue  # Main WebGL slideshow
│   │   └── LineLoader.vue     # Futuristic loading animation
│   ├── views/                 # Page components
│   │   └── NasaGallery.vue    # Gallery view
│   ├── stores/                # Pinia stores
│   ├── api/                   # NASA service layer
│   └── composables/           # Vue composables
└── public/                    # Static assets
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Deployment

The project is configured for Vercel deployment with:

- CORS proxy for NASA images
- Optimized image loading (standard quality)
- 36-image limit at medium quality for less bad bandwidth nerves

## License

MIT
