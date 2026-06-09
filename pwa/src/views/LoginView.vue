<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center p-4">
    <div class="w-full max-w-sm bg-gray-900 rounded-xl p-8 space-y-6">
      <div class="text-center">
        <div class="text-4xl mb-2">📸</div>
        <h1 class="text-xl font-bold text-white">Bruchési Photos</h1>
        <p class="text-gray-400 text-sm mt-1">Entrez votre email pour recevoir un lien de connexion</p>
      </div>
      <form @submit.prevent="submit" class="space-y-4">
        <input
          v-model="email"
          type="email"
          placeholder="votre@email.com"
          class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          required
        />
        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-green-600 hover:bg-green-500 text-white rounded-lg py-3 font-semibold transition disabled:opacity-50"
        >
          {{ loading ? 'Envoi...' : 'Recevoir mon lien' }}
        </button>
      </form>
      <p v-if="sent" class="text-green-400 text-sm text-center">
        ✓ Si cet email est enregistré, vous recevrez un lien sous peu.
      </p>
      <p v-if="error" class="text-red-400 text-sm text-center">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';

const email = ref('');
const loading = ref(false);
const sent = ref(false);
const error = ref('');

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    await axios.post('/api/auth/magic-link', { email: email.value });
    sent.value = true;
  } catch {
    error.value = 'Erreur réseau. Réessayez.';
  } finally {
    loading.value = false;
  }
}
</script>
