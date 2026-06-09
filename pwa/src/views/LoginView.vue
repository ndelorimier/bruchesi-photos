<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center p-4">
    <div class="w-full max-w-sm bg-gray-900 rounded-xl p-8 space-y-6">

      <div class="text-center">
        <div class="text-4xl mb-2">📸</div>
        <h1 class="text-xl font-bold text-white">Bruchési Photos</h1>
        <p class="text-gray-400 text-sm mt-1">
          {{ isEmploye ? 'Connexion employé / admin' : 'Entrez votre email pour recevoir un lien de connexion' }}
        </p>
      </div>

      <!-- Formulaire parent (magic link) -->
      <form v-if="!isEmploye" @submit.prevent="submitParent" class="space-y-4">
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
        <p v-if="sent" class="text-green-400 text-sm text-center">
          ✓ Si cet email est enregistré, vous recevrez un lien sous peu.
        </p>
      </form>

      <!-- Formulaire employé / admin -->
      <form v-else @submit.prevent="submitEmploye" class="space-y-4">
        <input
          v-model="email"
          type="email"
          placeholder="email@bruchesi.com"
          class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          required
        />
        <input
          v-model="password"
          type="password"
          placeholder="Mot de passe"
          class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          required
        />
        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-3 font-semibold transition disabled:opacity-50"
        >
          {{ loading ? 'Connexion...' : 'Se connecter' }}
        </button>
      </form>

      <p v-if="error" class="text-red-400 text-sm text-center">{{ error }}</p>

      <!-- Bascule parent ↔ employé -->
      <button
        @click="toggleMode"
        class="w-full text-xs text-gray-500 hover:text-gray-300 transition text-center pt-2"
      >
        {{ isEmploye ? '← Connexion parent (magic link)' : 'Accès employé / admin →' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const isEmploye = ref(false);
const email = ref('');
const password = ref('');
const loading = ref(false);
const sent = ref(false);
const error = ref('');

function toggleMode() {
  isEmploye.value = !isEmploye.value;
  email.value = '';
  password.value = '';
  error.value = '';
  sent.value = false;
}

async function submitParent() {
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

async function submitEmploye() {
  loading.value = true;
  error.value = '';
  try {
    const res = await axios.post('/api/employes/login', {
      email: email.value,
      password: password.value,
    });
    auth.setToken(res.data.token);
    // Redirection selon le rôle
    const role = res.data.role;
    if (role === 'ADMIN') router.push('/admin');
    else if (role === 'APPROBATEUR') router.push('/approbation');
    else router.push('/upload');
  } catch (err) {
    error.value = err.response?.data?.error || 'Identifiants incorrects.';
  } finally {
    loading.value = false;
  }
}
</script>
