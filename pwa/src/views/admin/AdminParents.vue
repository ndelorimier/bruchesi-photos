<template>
  <div class="space-y-4 max-w-3xl mx-auto">
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 class="font-semibold text-sm">Parents <span v-if="parents" class="text-gray-500 font-normal">({{ parents.length }})</span></h2>

      <input
        v-model="recherche"
        placeholder="🔍 Rechercher par email ou enfant…"
        class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
      />

      <p v-if="parents && !filtres.length" class="text-xs text-gray-500">Aucun parent trouvé.</p>

      <div v-for="p in filtres" :key="p.id" class="border border-gray-800 rounded-lg p-3 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-sm font-medium truncate">{{ p.email }}</div>
            <div class="text-xs text-gray-500">
              {{ p.prenom }} · enfant : {{ p.campeur.prenom }} {{ p.campeur.nom }} ({{ p.campeur.semaine.nom }})
            </div>
          </div>
          <div class="flex flex-col items-end gap-1 shrink-0">
            <span class="text-[10px] px-2 py-0.5 rounded-full" :class="p.compteActif ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'">
              {{ p.compteActif ? '🟢 Actif' : '⚪ Jamais connecté' }}
            </span>
            <span class="text-[10px] px-2 py-0.5 rounded-full" :class="p.consentementBiometrie ? 'bg-blue-900 text-blue-300' : 'bg-gray-800 text-gray-500'">
              {{ p.consentementBiometrie ? '🔐 Reco consentie' : '🚫 Reco non consentie' }}
            </span>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            @click="resend(p)"
            :disabled="sending === p.id"
            class="flex-1 bg-indigo-800 hover:bg-indigo-700 disabled:opacity-40 rounded-lg py-1.5 text-xs font-medium"
          >
            {{ sending === p.id ? 'Envoi…' : '✉️ Renvoyer le lien' }}
          </button>
          <button @click="remove(p)" class="bg-gray-800 hover:bg-red-900 rounded-lg px-3 py-1.5 text-xs">🗑️</button>
        </div>
      </div>
    </div>

    <p v-if="msg" :class="msg.ok ? 'text-green-400' : 'text-red-400'" class="text-sm text-center">{{ msg.text }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';

const parents = ref(null);
const recherche = ref('');
const sending = ref(null);
const msg = ref(null);

onMounted(load);

async function load() {
  parents.value = (await axios.get('/api/admin/parents')).data;
}

const filtres = computed(() => {
  if (!parents.value) return [];
  const q = recherche.value.trim().toLowerCase();
  if (!q) return parents.value;
  return parents.value.filter(p =>
    p.email.toLowerCase().includes(q) ||
    `${p.campeur.prenom} ${p.campeur.nom}`.toLowerCase().includes(q)
  );
});

async function resend(p) {
  sending.value = p.id;
  msg.value = null;
  try {
    const res = await axios.post(`/api/admin/parents/${p.id}/resend-link`);
    msg.value = { ok: true, text: `✓ ${res.data.message}` };
  } catch (err) {
    msg.value = { ok: false, text: err.response?.data?.error || "Erreur lors de l'envoi." };
  } finally {
    sending.value = null;
  }
}

async function remove(p) {
  if (!confirm(`Supprimer le parent ${p.email} ?`)) return;
  msg.value = null;
  try {
    await axios.delete(`/api/admin/parents/${p.id}`);
    msg.value = { ok: true, text: `✓ Parent supprimé.` };
    await load();
  } catch (err) {
    msg.value = { ok: false, text: err.response?.data?.error || 'Erreur lors de la suppression.' };
  }
}
</script>
