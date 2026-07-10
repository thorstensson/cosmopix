![Image](https://github.com/user-attachments/assets/96df9b56-8479-46f1-8267-7b276240ed68)

# NASA APODS

A cinematic WebGL slideshow for NASA's Astronomy Picture of the Day (APOD) archive.

https://nasa-apods.vercel.app/

## Features

- **FSD**: Feature Sliced Design...why will be evident in due time...
- **WebGL Slideshow**: Smooth transitions using Curtains.js
- **NASA APOD Integration**: Fetches images from the NASA Astronomy Picture of the Day (APOD) archive.
- **Sci-Fi**: Matrix-style loader with Nazalisation typography

## Tech Stack

- **Vue 3** with TypeScript
- **NASA APOD API** for imagery
- **Pinia** for state management & invocation of Service
- **Proxy rewrite** for CORS
- **Curtains.js** for WebGL transitions
- **Tailwind CSS** for styling

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
nasa-apod/
├── src/
│   ├── entities/              # Business domain entities
│   │   └── nasa-apod/         # NASA APOD data model & store
│   │       └── nasaStore.ts   # Pinia store for NASA data
│   ├── features/              # Feature-based modules
│   │   └── nasa-slideshow/    # NASA slideshow feature
│   │       ├── components/    # Feature-specific components (PreviousButton, NextButton, NasaMetadata)
│   │       ├── NasaSlideshow.vue  # Main WebGL slideshow component
│   │       ├── useNasaAPI.ts      # Vue composable for NASA API
│   │       ├── utils.ts           # Feature utilities
│   │       └── curtainsjs.d.ts    # TypeScript definitions
│   ├── shared/               # Shared resources
│   │   ├── ui/              # Reusable UI components
│   │   │   ├── LineLoader.vue     # Futuristic loading animation
│   │   │   └── GitHubIcon.vue     # Custom GitHub icon component
│   │   ├── api/             # Shared API utilities
│   │   │   └── nasaService.ts     # NASA API service
│   │   └── utils/           # Shared utilities
│   ├── pages/               # Page components
│   │   └── NasaGallery.vue  # Gallery view
│   ├── layouts/             # Layout components
│   ├── assets/              # Static assets (CSS, images)
│   ├── __tests__/           # Test files
│   ├── App.vue              # Root component
│   └── main.ts              # Application entry point
├── public/                  # Public static assets
├── vercel.json             # Vercel deployment configuration
├── package.json            # Dependencies and scripts
├── tailwind.config.js      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite build configuration
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
