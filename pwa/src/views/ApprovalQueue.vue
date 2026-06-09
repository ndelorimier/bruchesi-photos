<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <div class="bg-orange-900/50 px-4 py-4">
      <h1 class="font-bold text-lg">File d'approbation</h1>
      <p class="text-gray-400 text-sm">{{ photos.length }} photo(s) en attente</p>
    </div>

    <div class="p-3 space-y-3 pb-20">
      <div v-for="photo in photos" :key="photo.id" class="bg-gray-900 rounded-xl overflow-hidden">
        <img :src="`/api/photos/file/${photo.id}/thumb`" class="w-full aspect-video object-cover" />
        <div class="p-3 space-y-2">
          <div class="flex flex-wrap gap-1">
            <span
              v-for="tag in photo.tags"
              :key="tag.campeurId"
              class="bg-gray-700 text-xs px-2 py-1 rounded-full"
            >
              {{ tag.campeur.prenom }} {{ (tag.confidence * 100).toFixed(0) }}%
            </span>
            <span v-if="!photo.tags.length" class="text-gray-500 text-xs">Aucun visage détecté</span>
          </div>
          <div class="flex gap-2">
            <button @click="approve(photo.id)" class="flex-1 bg-green-700 hover:bg-green-600 rounded-lg py-2 text-sm font-semibold">✓ Approuver</button>
            <button @click="reject(photo.id)" class="flex-1 bg-red-900 hover:bg-red-800 rounded-lg py-2 text-sm font-semibold">✗ Rejeter</button>
          </div>
        </div>
      </div>

      <button
        v-if="photos.length > 1"
        @click="approveAll"
        class="w-full bg-blue-700 hover:bg-blue-600 rounded-xl py-3 font-semibold"
      >
        ✓ Tout approuver ({{ photos.length }})
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const photos = ref([]);

onMounted(async () => {
  photos.value = (await axios.get('/api/photos/pending')).data;
});

async function approve(id) {
  await axios.post(`/api/photos/${id}/approve`);
  photos.value = photos.value.filter(p => p.id !== id);
}

async function reject(id) {
  await axios.post(`/api/photos/${id}/reject`);
  photos.value = photos.value.filter(p => p.id !== id);
}

async function approveAll() {
  await Promise.all(photos.value.map(p => axios.post(`/api/photos/${p.id}/approve`)));
  photos.value = [];
}
</script>
