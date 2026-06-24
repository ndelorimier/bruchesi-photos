<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <div class="bg-gray-900 px-4 py-4">
      <h1 class="font-bold text-lg">👤 Mon profil</h1>
    </div>
    <div class="p-4 space-y-4">
      <!-- Enfants -->
      <div v-for="p in me" :key="p.id" class="bg-gray-900 rounded-xl p-4">
        <p class="font-semibold">{{ p.campeur.prenom }} {{ p.campeur.nom }}</p>
        <p class="text-sm text-gray-400">{{ p.campeur.semaine?.nom }}</p>
        <p class="text-xs mt-2" :class="p.campeur.statut === 'CONFIRME' ? 'text-green-400' : 'text-yellow-400'">
          Enrôlement : {{ p.campeur.statut }}
        </p>
      </div>

      <!-- Notifications push -->
      <div class="bg-gray-900 rounded-xl p-4 space-y-3">
        <h2 class="font-semibold text-sm">🔔 Notifications</h2>
        <p class="text-xs text-gray-400">Soyez averti dès qu'une nouvelle photo de votre enfant est approuvée.</p>
        <button
          v-if="!push.subscribed.value"
          @click="push.enable()"
          :disabled="push.busy.value"
          class="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 rounded-lg py-2.5 text-sm font-semibold"
        >
          {{ push.busy.value ? 'Activation…' : 'Activer les notifications' }}
        </button>
        <button
          v-else
          @click="push.disable()"
          :disabled="push.busy.value"
          class="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-lg py-2.5 text-sm"
        >
          {{ push.busy.value ? '…' : '🔕 Désactiver les notifications' }}
        </button>
        <p v-if="push.subscribed.value" class="text-green-400 text-xs text-center">✓ Notifications activées sur cet appareil</p>
        <p v-if="push.error.value" class="text-red-400 text-xs text-center">{{ push.error.value }}</p>
      </div>

      <!-- Photo de référence -->
      <div class="bg-gray-900 rounded-xl p-4 space-y-3">
        <h2 class="font-semibold text-sm">Photo de référence de votre enfant</h2>
        <p class="text-xs text-gray-400">Une photo claire du visage de votre enfant améliore la précision de la reconnaissance.</p>
        <label class="block w-full border border-dashed border-gray-700 rounded-lg p-4 text-center cursor-pointer">
          <input type="file" accept="image/*" class="hidden" @change="uploadRef" />
          <span class="text-gray-400 text-sm">Sélectionner une photo</span>
        </label>
        <p v-if="refSuccess" class="text-green-400 text-sm">✓ Photo soumise — en attente de validation.</p>
      </div>

      <button @click="logout" class="w-full bg-gray-800 rounded-xl py-3 text-sm text-gray-400">
        Se déconnecter
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { useAuthStore } from '../stores/auth';
import { usePush } from '../composables/usePush';

const auth = useAuthStore();
const router = useRouter();
const me = ref([]);
const refSuccess = ref(false);
const push = usePush();

onMounted(async () => {
  me.value = (await axios.get('/api/parents/me')).data;
  push.refresh();
});

async function uploadRef(e) {
  const form = new FormData();
  form.append('file', e.target.files[0]);
  await axios.post('/api/parents/reference-photo', form);
  refSuccess.value = true;
}

function logout() {
  auth.logout();
  router.push('/login');
}
</script>
