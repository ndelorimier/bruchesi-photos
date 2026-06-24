<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <div class="bg-orange-900/50 px-4 py-4">
      <h1 class="font-bold text-lg">File d'approbation</h1>
      <p class="text-gray-400 text-sm">{{ photos.length }} photo(s) en attente</p>
    </div>

    <div class="p-3 space-y-3 pb-24">
      <div v-for="photo in photos" :key="photo.id" class="bg-gray-900 rounded-xl overflow-hidden">
        <img :src="`/api/photos/file/${photo.id}/thumb`" class="w-full aspect-video object-cover" />
        <div class="p-3 space-y-2">
          <!-- Campeurs sélectionnés -->
          <div class="flex flex-wrap gap-1">
            <span v-for="c in photo._sel" :key="c.id"
              class="bg-blue-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
              {{ c.prenom }} {{ c.nom }}
              <button @click="remove(photo, c)" class="text-blue-200 hover:text-white">×</button>
            </span>
            <span v-if="!photo._sel.length" class="text-yellow-500 text-xs">⚠ Aucun campeur — la photo ne sera vue par aucun parent</span>
          </div>

          <!-- Recherche de campeurs -->
          <input
            v-model="photo._q"
            placeholder="🔍 Qui est sur la photo ?"
            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          />
          <div v-if="photo._q && matches(photo).length" class="bg-gray-800 rounded-lg divide-y divide-gray-700 max-h-44 overflow-y-auto">
            <button v-for="c in matches(photo)" :key="c.id" @click="add(photo, c)"
              class="w-full text-left px-3 py-2 text-sm hover:bg-gray-700">
              {{ c.prenom }} {{ c.nom }} <span class="text-gray-500 text-xs">· {{ c.semaine?.nom }}</span>
            </button>
          </div>

          <div class="flex gap-2 pt-1">
            <button @click="approve(photo)" :disabled="photo._busy"
              class="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 rounded-lg py-2 text-sm font-semibold">✓ Approuver</button>
            <button @click="reject(photo)" :disabled="photo._busy"
              class="flex-1 bg-red-900 hover:bg-red-800 disabled:opacity-40 rounded-lg py-2 text-sm font-semibold">✗ Rejeter</button>
          </div>
        </div>
      </div>

      <p v-if="!photos.length" class="text-center text-gray-500 py-12">Aucune photo en attente 🎉</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const photos = ref([]);
const campeurs = ref([]);

onMounted(async () => {
  const [pend, camps] = await Promise.all([
    axios.get('/api/photos/pending'),
    axios.get('/api/campeurs'),
  ]);
  campeurs.value = camps.data;
  // État d'édition par photo : campeurs sélectionnés (pré-remplis avec les tags IA s'il y en a) + recherche
  photos.value = pend.data.map(p => ({
    ...p,
    _sel: (p.tags || []).map(t => t.campeur).filter(Boolean),
    _q: '',
    _busy: false,
  }));
});

function matches(photo) {
  const q = photo._q.trim().toLowerCase();
  if (!q) return [];
  const selIds = new Set(photo._sel.map(c => c.id));
  return campeurs.value
    .filter(c => !selIds.has(c.id) && `${c.prenom} ${c.nom}`.toLowerCase().includes(q))
    .slice(0, 8);
}

function add(photo, c) {
  photo._sel.push(c);
  photo._q = '';
}

function remove(photo, c) {
  photo._sel = photo._sel.filter(x => x.id !== c.id);
}

async function approve(photo) {
  photo._busy = true;
  try {
    const tags = photo._sel.map(c => ({ campeurId: c.id, confidence: 1 }));
    await axios.post(`/api/photos/${photo.id}/approve`, { tags });
    photos.value = photos.value.filter(p => p.id !== photo.id);
  } catch {
    photo._busy = false;
    alert("Erreur lors de l'approbation.");
  }
}

async function reject(photo) {
  photo._busy = true;
  try {
    await axios.post(`/api/photos/${photo.id}/reject`);
    photos.value = photos.value.filter(p => p.id !== photo.id);
  } catch {
    photo._busy = false;
    alert('Erreur lors du rejet.');
  }
}
</script>
