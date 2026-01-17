<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue'

  const props = defineProps<{
    duration?: number // Total animation duration in ms
  }>()

  const emit = defineEmits<{
    complete: []
  }>()

  const duration = props.duration || 2800 // 2.8 seconds default
  const totalLines = 20
  const progress = ref(0)
  const lineStates = ref(Array(20).fill(false))

  let animationFrame: number
  let startTime: number
  let fillOrder: number[] = []

  const initFillOrder = () => {
    // Create random fill order once at start
    fillOrder = Array.from({ length: totalLines }, (_, i) => i)
    for (let i = fillOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = fillOrder[i]!
      fillOrder[i] = fillOrder[j]!
      fillOrder[j] = temp
    }
  }

  const animate = (timestamp: number) => {
    if (!startTime) startTime = timestamp

    const elapsed = timestamp - startTime
    progress.value = Math.min(elapsed / duration, 1)

    // Calculate exactly how many lines should be filled
    const linesToFill = Math.floor(progress.value * totalLines)

    // Fill lines in the pre-determined random order
    for (let i = 0; i < totalLines; i++) {
      lineStates.value[i] = fillOrder[i]! < linesToFill
    }

    if (progress.value < 1) {
      animationFrame = requestAnimationFrame(animate)
    } else {
      // Ensure all lines are filled at 100%
      lineStates.value = Array(20).fill(true)

      // Animation complete
      setTimeout(() => {
        emit('complete')
      }, 500)
    }
  }

  onMounted(() => {
    // Initialize random fill order
    initFillOrder()

    // Start animation after a small delay
    setTimeout(() => {
      startTime = 0
      animationFrame = requestAnimationFrame(animate)
    }, 100)
  })

  onUnmounted(() => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
    }
  })
</script>

<template>
  <div class="line-loader-container flex min-h-[200px] flex-col items-center justify-center p-8">
    <!-- Futuristic loading matrix -->
    <div class="relative max-w-md">
      <!-- Grid container -->
      <div class="grid grid-cols-5 gap-2">
        <div
          v-for="(_, index) in 20"
          :key="`line-${index}`"
          class="relative aspect-square h-8 overflow-hidden rounded border border-gray-700/50 bg-gray-900/80"
        >
          <!-- Empty line background -->
          <div class="absolute inset-0 bg-gray-900/80"></div>

          <!-- Filling effect -->
          <div
            class="absolute inset-0 transform bg-linear-to-b from-white via-gray-300 to-white transition-all duration-500 ease-out"
            :class="[
              lineStates[index] ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
            ]"
            :style="{
              transitionDelay: `${Math.random() * 800}ms`
            }"
          ></div>

          <!-- Glow effect when filled -->
          <div
            class="absolute inset-0 rounded border border-white/30 transition-all duration-300"
            :class="[
              lineStates[index]
                ? 'opacity-100 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                : 'opacity-0'
            ]"
          ></div>
        </div>
      </div>

      <!-- Progress indicator -->
      <div class="mt-4 text-center">
        <div class="font-sans text-2xl tracking-wider text-white">
          {{ Math.round(progress * 100) }}<span class="text-gray-400">%</span>
        </div>
      </div>
    </div>

    <!-- Status messages -->
    <div class="mt-4 text-center">
      <div class="font-sans text-sm tracking-wider text-gray-300">
        <span class="text-white">ACCESSING</span> NASA APOD DATABASE
      </div>
      <div class="mt-1 font-mono text-xs text-gray-500">
        <span class="blink">▌</span> READY FOR COSMIC DISPLAY <span class="blink">▌</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .blink {
    animation: blink 1s infinite;
    opacity: 1;
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }
</style>
