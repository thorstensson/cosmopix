<script setup lang="ts">
  import NasaGallery from './pages/NasaGallery.vue'
  import { useSeoMeta } from '@unhead/vue'

  useSeoMeta({
    title: 'NASA APODS | Thomas Thorstensson',
    description:
      "A cinematic WebGL slideshow exploring NASA's Astronomy Picture of the Day archive.",
    ogImage: 'https://nasa-apods.vercel.app/og-image.jpg',
    ogUrl: 'https://nasa-apods.vercel.app/'
  })
</script>

<template>
  <main
    class="mx-auto flex h-screen w-screen max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8"
  >
    <NasaGallery />
  </main>
</template>
