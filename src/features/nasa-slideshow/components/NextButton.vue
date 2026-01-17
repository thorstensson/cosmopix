<script setup lang="ts">
  interface Props {
    isNextDisabled: boolean
  }

  withDefaults(defineProps<Props>(), {
    isNextDisabled: false
  })

  const emit = defineEmits(['nextSlide'])

  function nextSlide() {
    emit('nextSlide')
  }
</script>

<template>
  <!-- Previous Button -->
  <button
    @click="nextSlide"
    :disabled="isNextDisabled"
    class="pointer-events-auto absolute top-1/2 right-4 -translate-y-1/2 rounded-full bg-black/30 p-3 backdrop-blur-sm transition-all duration-300 hover:bg-black/50 disabled:cursor-default disabled:opacity-30"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-8 w-8 text-white max-sm:h-5 max-sm:w-5"
      viewBox="0 0 24 24"
      stroke="currentColor"
      fill="none"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
    </svg>
  </button>
</template>
