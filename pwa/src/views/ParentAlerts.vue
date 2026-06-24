<template>
  <div class="min-h-screen bg-gray-950 text-white pb-16">
    <div class="bg-gray-900 px-4 py-4">
      <h1 class="font-bold text-lg">🔔 Alertes</h1>
    </div>
    <div class="p-3 space-y-2">
      <div v-for="n in notifs" :key="n.id" class="bg-gray-900 rounded-lg p-3 flex gap-3 items-center">
        <AuthImg v-if="n.photo?.thumbnailPath" :src="`/api/photos/file/${n.photoId}/thumb`" class="w-12 h-12 rounded object-cover" />
        <div>
          <p class="text-sm text-white">📸 Nouvelle photo</p>
          <p class="text-xs text-gray-400">{{ new Date(n.sentAt).toLocaleString('fr-CA') }}</p>
        </div>
      </div>
      <p v-if="!notifs.length" class="text-center text-gray-500 py-12">Aucune alerte</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import AuthImg from '../components/AuthImg.vue';
const notifs = ref([]);
onMounted(async () => { notifs.value = (await axios.get('/api/parents/notifications')).data; });
</script>
