<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <!-- Header -->
    <div class="bg-gray-900 px-4 py-4 flex items-center justify-between">
      <div>
        <h1 class="font-bold text-lg">📸 Bruchési Photos</h1>
        <p class="text-gray-400 text-sm">{{ semaineLabel }}</p>
      </div>
      <button @click="downloadZip" class="text-green-400 text-sm">⬇ ZIP</button>
    </div>

    <!-- Grille photos -->
    <div v-if="photos.length" class="p-2 grid grid-cols-3 gap-1">
      <PhotoCard v-for="p in photos" :key="p.id" :photo="p" />
    </div>
    <div v-else class="flex items-center justify-center h-64 text-gray-500">
      Aucune photo pour le moment
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import PhotoCard from '../components/PhotoCard.vue';

const photos = ref([]);
const me = ref([]);

const semaineLabel = computed(() => {
  const semaines = [...new Set(me.value.map(p => p.campeur?.semaine?.nom))].filter(Boolean);
  return semaines.join(', ') || '';
});

onMounted(async () => {
  const [photosRes, meRes] = await Promise.all([
    axios.get('/api/parents/photos'),
    axios.get('/api/parents/me'),
  ]);
  photos.value = photosRes.data;
  me.value = meRes.data;
});

async function downloadZip() {
  try {
    const res = await axios.get('/api/parents/photos/download', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bruchesi-photos.zip';
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    alert('Erreur lors du téléchargement.');
  }
}
</script>
