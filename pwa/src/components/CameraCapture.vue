<template>
  <div class="space-y-3">
    <video ref="video" autoplay playsinline class="w-full rounded-lg bg-gray-800 aspect-video" />
    <button
      @click="capture"
      class="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-3 font-semibold"
    >
      📸 Prendre la photo
    </button>
    <canvas ref="canvas" class="hidden" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const emit = defineEmits(['captured']);
const video = ref(null);
const canvas = ref(null);
let stream = null;

onMounted(async () => {
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
  video.value.srcObject = stream;
});

onUnmounted(() => stream?.getTracks().forEach(t => t.stop()));

function capture() {
  canvas.value.width = video.value.videoWidth;
  canvas.value.height = video.value.videoHeight;
  canvas.value.getContext('2d').drawImage(video.value, 0, 0);
  canvas.value.toBlob(blob => emit('captured', blob), 'image/jpeg', 0.92);
}
</script>
