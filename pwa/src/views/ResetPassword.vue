<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center p-4">
    <div class="w-full max-w-sm bg-gray-900 rounded-xl p-8 space-y-6">
      <div class="text-center">
        <div class="text-4xl mb-2">🔑</div>
        <h1 class="text-xl font-bold text-white">Nouveau mot de passe</h1>
        <p class="text-gray-400 text-sm mt-1">Choisissez un nouveau mot de passe.</p>
      </div>

      <div v-if="!token" class="text-red-400 text-sm text-center">
        Lien invalide — il manque le jeton. Recommencez depuis « Mot de passe oublié ».
      </div>

      <form v-else-if="!done" @submit.prevent="submit" class="space-y-4">
        <input
          v-model="pwd" type="password" placeholder="Nouveau mot de passe (8 car. min.)" required
          class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        <input
          v-model="confirm" type="password" placeholder="Confirmer le mot de passe" required
          class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        <button type="submit" :disabled="loading"
          class="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-3 font-semibold transition disabled:opacity-50">
          {{ loading ? 'Mise à jour...' : 'Réinitialiser' }}
        </button>
        <p v-if="error" class="text-red-400 text-sm text-center">{{ error }}</p>
      </form>

      <div v-else class="space-y-4 text-center">
        <p class="text-green-400 text-sm">✓ Mot de passe réinitialisé.</p>
        <button @click="router.push('/login')"
          class="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-3 font-semibold transition">
          Se connecter
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const router = useRouter();

const token = ref(route.query.token || '');
const pwd = ref('');
const confirm = ref('');
const loading = ref(false);
const error = ref('');
const done = ref(false);

async function submit() {
  error.value = '';
  if (pwd.value.length < 8) { error.value = 'Mot de passe : 8 caractères minimum.'; return; }
  if (pwd.value !== confirm.value) { error.value = 'Les mots de passe ne correspondent pas.'; return; }
  loading.value = true;
  try {
    await axios.post('/api/employes/reset-password', { token: token.value, newPassword: pwd.value });
    done.value = true;
  } catch (err) {
    error.value = err.response?.data?.error || 'Erreur. Le lien a peut-être expiré.';
  } finally {
    loading.value = false;
  }
}
</script>
