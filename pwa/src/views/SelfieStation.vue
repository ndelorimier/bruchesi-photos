<template>
  <div class="min-h-screen bg-gray-950 text-white p-4 space-y-4">
    <div class="bg-blue-900/50 rounded-xl p-4">
      <h1 class="font-bold text-lg">📸 Selfie Station</h1>
      <p class="text-gray-400 text-sm">Semaine en cours</p>
    </div>

    <input
      v-model="query"
      @input="search"
      type="text"
      placeholder="Chercher un campeur..."
      class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
    />

    <div v-if="campeur" class="bg-gray-900 rounded-xl p-4 space-y-3">
      <div>
        <p class="font-bold text-lg">{{ campeur.prenom }} {{ campeur.nom }}</p>
        <p class="text-sm text-gray-400">{{ campeur.semaine?.nom }}</p>
        <div class="flex gap-2 mt-2">
          <span :class="hasParentPhoto ? 'text-green-400' : 'text-yellow-400'" class="text-xs">
            {{ hasParentPhoto ? '✓' : '○' }} Photo parent
          </span>
          <span :class="hasSelfie ? 'text-green-400' : 'text-yellow-400'" class="text-xs">
            {{ hasSelfie ? '✓' : '○' }} Selfie station
          </span>
        </div>
      </div>
      <CameraCapture @captured="enrollSelfie" />
      <p v-if="success" class="text-green-400 text-sm text-center">✓ Enrôlé avec succès !</p>
      <p v-if="error" class="text-red-400 text-sm text-center">{{ error }}</p>
    </div>

    <div v-if="results.length && !campeur" class="space-y-2">
      <div
        v-for="c in results"
        :key="c.id"
        @click="selectCampeur(c)"
        class="bg-gray-900 rounded-lg p-3 cursor-pointer hover:bg-gray-800"
      >
        <p class="font-medium">{{ c.prenom }} {{ c.nom }}</p>
        <p class="text-xs text-gray-400">{{ c.semaine?.nom }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import axios from 'axios';
import CameraCapture from '../components/CameraCapture.vue';

const query = ref('');
const results = ref([]);
const campeur = ref(null);
const success = ref(false);
const error = ref('');

const hasParentPhoto = computed(() => campeur.value?.faceProfiles?.some(p => p.type === 'PARENT_SUBMIT'));
const hasSelfie = computed(() => campeur.value?.faceProfiles?.some(p => p.type === 'SELFIE_STATION'));

async function search() {
  if (query.value.length < 2) { results.value = []; return; }
  const res = await axios.get(`/api/campeurs?q=${query.value}`);
  results.value = res.data;
}

function selectCampeur(c) { campeur.value = c; results.value = []; }

async function enrollSelfie(blob) {
  error.value = '';
  success.value = false;
  const form = new FormData();
  form.append('file', blob, 'selfie.jpg');
  form.append('type', 'SELFIE_STATION');
  try {
    await axios.post(`/api/campeurs/${campeur.value.id}/enroll-profile`, form);
    success.value = true;
    if (!campeur.value.faceProfiles) campeur.value.faceProfiles = [];
    campeur.value.faceProfiles.push({ type: 'SELFIE_STATION' });
  } catch {
    error.value = 'Erreur lors de l\'enrôlement.';
  }
}
</script>
