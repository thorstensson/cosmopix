<script setup lang="ts">
  /**
   * Handles metadata display and uses utils for formatting thereof.
   */
  import { formatDate } from '../utils'
  interface Props {
    currentMetadata: {
      title: string
      date: string
      copyright?: string
      explanation: string
      media_type: string
      service_version: string
    }
  }

  // Assign the result to 'props'
  const props = withDefaults(defineProps<Props>(), {
    currentMetadata: () => ({
      title: '',
      date: '',
      copyright: '',
      explanation: '',
      media_type: '',
      service_version: ''
    })
  })
</script>

<template>
  <div
    v-if="props.currentMetadata"
    class="bg-space-black/20 absolute bottom-4 left-4 max-w-64 rounded-lg font-sans text-white backdrop-blur-sm sm:bottom-8 sm:left-8 sm:max-w-sm md:bottom-8 md:max-w-md"
  >
    <h3 class="mb-1 line-clamp-2 text-sm font-bold">
      {{ props.currentMetadata.title }}
    </h3>
    <div class="space-y-1 text-base md:text-lg">
      <div class="flex flex-wrap items-center gap-1 sm:gap-2">
        <span class="text-xs text-gray-300">Date:</span>
        <span class="text-xs">{{ formatDate(props.currentMetadata.date) }}</span>
        <span v-if="props.currentMetadata.copyright" class="ml-2 text-xs text-gray-300">•</span>
        <span v-if="props.currentMetadata.copyright" class="text-xs text-gray-300 sm:text-xs"
          >Copyright:</span
        >
        <span v-if="props.currentMetadata.copyright" class="truncate text-xs">{{
          props.currentMetadata.copyright
        }}</span>
      </div>
      <div class="mt-2 hidden sm:block">
        <p class="line-clamp-2 text-xs sm:text-xs md:line-clamp-5">
          {{ props.currentMetadata.explanation }}
        </p>
      </div>
      <div class="mt-1 text-xs text-gray-400 sm:mt-2 md:text-sm">
        Media type: {{ props.currentMetadata.media_type }} • Service version:
        {{ props.currentMetadata.service_version }}
      </div>
    </div>
  </div>
</template>
