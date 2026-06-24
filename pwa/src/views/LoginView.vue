<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center p-4">
    <div class="w-full max-w-sm bg-gray-900 rounded-xl p-8 space-y-6">

      <div class="text-center">
        <img src="/logo-campbru.png" alt="Camp Bruchési" class="mx-auto h-28 w-auto mb-3" />
        <p class="text-gray-400 text-sm">
          {{ sousTitre }}
        </p>
      </div>

      <!-- Mode parent (magic link) -->
      <form v-if="view === 'parent'" @submit.prevent="submitParent" class="space-y-4">
        <input
          v-model="email" type="email" placeholder="votre@email.com" required
          class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
        />
        <button type="submit" :disabled="loading"
          class="w-full bg-green-600 hover:bg-green-500 text-white rounded-lg py-3 font-semibold transition disabled:opacity-50">
          {{ loading ? 'Envoi...' : 'Recevoir mon lien' }}
        </button>
        <p v-if="sent" class="text-green-400 text-sm text-center">
          ✓ Si cet email est enregistré, vous recevrez un lien sous peu.
        </p>
      </form>

      <!-- Mode employé / admin -->
      <form v-else-if="view === 'employe'" @submit.prevent="submitEmploye" class="space-y-4">
        <input
          v-model="email" type="email" placeholder="email@bruchesi.com" required
          class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        <input
          v-model="password" type="password" placeholder="Mot de passe" required
          class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        <button type="submit" :disabled="loading"
          class="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-3 font-semibold transition disabled:opacity-50">
          {{ loading ? 'Connexion...' : 'Se connecter' }}
        </button>
        <button type="button" @click="goTo('forgot')"
          class="w-full text-xs text-gray-500 hover:text-gray-300 transition text-center">
          Mot de passe oublié ?
        </button>
      </form>

      <!-- Mode mot de passe oublié -->
      <form v-else @submit.prevent="submitForgot" class="space-y-4">
        <input
          v-model="email" type="email" placeholder="email@bruchesi.com" required
          class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        <button type="submit" :disabled="loading"
          class="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-3 font-semibold transition disabled:opacity-50">
          {{ loading ? 'Envoi...' : 'Envoyer le lien de réinitialisation' }}
        </button>
        <p v-if="sent" class="text-green-400 text-sm text-center">
          ✓ Si ce courriel correspond à un compte, un lien vous a été envoyé.
        </p>
        <button type="button" @click="goTo('employe')"
          class="w-full text-xs text-gray-500 hover:text-gray-300 transition text-center">
          ← Retour à la connexion
        </button>
      </form>

      <p v-if="error" class="text-red-400 text-sm text-center">{{ error }}</p>

      <!-- Bascule parent ↔ employé -->
      <button v-if="view !== 'forgot'" @click="goTo(view === 'employe' ? 'parent' : 'employe')"
        class="w-full text-xs text-gray-500 hover:text-gray-300 transition text-center pt-2">
        {{ view === 'employe' ? '← Connexion parent (magic link)' : 'Accès employé / admin →' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const view = ref('parent'); // 'parent' | 'employe' | 'forgot'
const email = ref('');
const password = ref('');
const loading = ref(false);
const sent = ref(false);
const error = ref('');

const sousTitre = computed(() => {
  if (view.value === 'employe') return 'Connexion employé / admin';
  if (view.value === 'forgot') return 'Réinitialiser votre mot de passe';
  return 'Entrez votre email pour recevoir un lien de connexion';
});

function goTo(v) {
  view.value = v;
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
    const res = await axios.post('/api/employes/login', { email: email.value, password: password.value });
    auth.setToken(res.data.token);
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

async function submitForgot() {
  loading.value = true;
  error.value = '';
  try {
    await axios.post('/api/employes/forgot-password', { email: email.value });
    sent.value = true;
  } catch (err) {
    error.value = err.response?.data?.error || 'Erreur réseau. Réessayez.';
  } finally {
    loading.value = false;
  }
}
</script>
