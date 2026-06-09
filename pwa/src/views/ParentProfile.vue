<template>
  <div class="min-h-screen bg-gray-950 text-white pb-16">
    <div class="bg-gray-900 px-4 py-4">
      <h1 class="font-bold text-lg">👤 Mon profil</h1>
    </div>
    <div class="p-4 space-y-4">
      <div v-for="p in me" :key="p.id" class="bg-gray-900 rounded-xl p-4">
        <p class="font-semibold">{{ p.campeur.prenom }} {{ p.campeur.nom }}</p>
        <p class="text-sm text-gray-400">{{ p.campeur.semaine?.nom }}</p>
        <p class="text-xs mt-2" :class="p.campeur.statut === 'CONFIRME' ? 'text-green-400' : 'text-yellow-400'">
          Enrôlement : {{ p.campeur.statut }}
        </p>
      </div>

      <div class="bg-gray-900 rounded-xl p-4 space-y-3">
        <h2 class="font-semibold text-sm">Photo de référence de votre enfant</h2>
        <p class="text-xs text-gray-400">Une photo claire du visage de votre enfant améliore la précision de la reconnaissance.</p>
        <label class="block w-full border border-dashed border-gray-700 rounded-lg p-4 text-center cursor-pointer">
          <input type="file" accept="image/*" class="hidden" @change="uploadRef" />
          <span class="text-gray-400 text-sm">Sélectionner une photo</span>
        </label>
        <p v-if="refSuccess" class="text-green-400 text-sm">✓ Photo soumise — en attente de validation.</p>
      </div>

      <button @click="auth.logout(); $router.push('/login')" class="w-full bg-gray-800 rounded-xl py-3 text-sm text-gray-400">
        Se déconnecter
      </button>
    </div>
    <nav class="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex">
      <router-link to="/" class="flex-1 py-3 text-center text-xs" active-class="text-green-400">📸 Photos</router-link>
      <router-link to="/alertes" class="flex-1 py-3 text-center text-xs" active-class="text-green-400">🔔 Alertes</router-link>
      <router-link to="/profil" class="flex-1 py-3 text-center text-xs" active-class="text-green-400">👤 Profil</router-link>
    </nav>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { useAuthStore } from '../stores/auth';
const auth = useAuthStore();
const me = ref([]);
const refSuccess = ref(false);
onMounted(async () => { me.value = (await axios.get('/api/parents/me')).data; });
async function uploadRef(e) {
  const form = new FormData();
  form.append('file', e.target.files[0]);
  await axios.post('/api/parents/reference-photo', form);
  refSuccess.value = true;
}
</script>
