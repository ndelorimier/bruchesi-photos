<template>
  <div class="space-y-4 max-w-3xl mx-auto">
    <!-- Import CSV -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 class="font-semibold text-sm">Import CSV campeurs</h2>
      <p class="text-xs text-gray-400">Colonnes : prenom_enfant, nom_enfant, semaine, prenom_parent, email_parent</p>
      <label class="block w-full border border-dashed border-gray-700 rounded-lg p-4 text-center cursor-pointer hover:border-gray-500 transition">
        <input type="file" accept=".csv" class="hidden" @change="importCsv" />
        <span class="text-gray-400 text-sm">{{ importing ? 'Import en cours…' : 'Sélectionner un fichier CSV' }}</span>
      </label>

      <!-- Rapport d'import -->
      <div v-if="rapport" class="text-xs space-y-1">
        <p class="text-green-400">✓ {{ rapport.created }} parent(s) créé(s) sur {{ rapport.total }} ligne(s)<template v-if="rapport.doublons"> · {{ rapport.doublons }} doublon(s) ignoré(s)</template></p>
        <div v-if="rapport.ignorees.length" class="bg-red-950/50 border border-red-900 rounded-lg p-2 space-y-0.5">
          <p class="text-red-300 font-medium">{{ rapport.ignorees.length }} ligne(s) ignorée(s) :</p>
          <p v-for="(ig, i) in rapport.ignorees" :key="i" class="text-red-400">Ligne {{ ig.ligne }} — {{ ig.raison }}</p>
        </div>
      </div>
    </div>

    <!-- Filtre + liste -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold text-sm">Campeurs <span v-if="campeurs" class="text-gray-500 font-normal">({{ campeurs.length }})</span></h2>
        <select v-model="filtreSemaine" @change="load" class="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs">
          <option value="">Toutes les semaines</option>
          <option v-for="s in semaines" :key="s.id" :value="s.id">{{ s.nom }}</option>
        </select>
      </div>

      <input
        v-model="recherche"
        placeholder="🔍 Rechercher un campeur…"
        class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
      />

      <p v-if="campeurs && !campeursFiltres.length" class="text-xs text-gray-500">Aucun campeur trouvé.</p>

      <div v-for="c in campeursFiltres" :key="c.id" class="flex items-center justify-between border border-gray-800 rounded-lg p-3 gap-2">
        <div>
          <div class="text-sm font-medium">{{ c.prenom }} {{ c.nom }}</div>
          <div class="text-xs text-gray-500">{{ c.semaine.nom }}</div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-[10px] px-2 py-0.5 rounded-full" :class="badgeEnrolement(c.statut)">{{ libEnrolement(c.statut) }}</span>
          <button @click="remove(c)" class="text-xs bg-gray-800 hover:bg-red-900 rounded-lg px-3 py-1.5">🗑️</button>
        </div>
      </div>
    </div>

    <p v-if="msg" :class="msg.ok ? 'text-green-400' : 'text-red-400'" class="text-sm text-center">{{ msg.text }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';

const semaines = ref([]);
const campeurs = ref(null);
const filtreSemaine = ref('');
const recherche = ref('');
const rapport = ref(null);
const importing = ref(false);
const msg = ref(null);

onMounted(async () => {
  semaines.value = (await axios.get('/api/admin/semaines')).data;
  await load();
});

async function load() {
  const params = filtreSemaine.value ? { semaine: filtreSemaine.value } : {};
  campeurs.value = (await axios.get('/api/campeurs', { params })).data;
}

const campeursFiltres = computed(() => {
  if (!campeurs.value) return [];
  const q = recherche.value.trim().toLowerCase();
  if (!q) return campeurs.value;
  return campeurs.value.filter(c => `${c.prenom} ${c.nom}`.toLowerCase().includes(q));
});

function badgeEnrolement(s) {
  if (s === 'CONFIRME') return 'bg-green-900 text-green-300';
  if (s === 'PARTIEL') return 'bg-yellow-900 text-yellow-300';
  return 'bg-gray-800 text-gray-400';
}
function libEnrolement(s) {
  if (s === 'CONFIRME') return '🟢 Enrôlé';
  if (s === 'PARTIEL') return '🟡 Partiel';
  return '⚪ Aucun visage';
}

async function importCsv(e) {
  const file = e.target.files[0];
  if (!file) return;
  importing.value = true;
  rapport.value = null;
  msg.value = null;
  try {
    const form = new FormData();
    form.append('file', file);
    rapport.value = (await axios.post('/api/admin/import-csv', form)).data;
    await load();
    semaines.value = (await axios.get('/api/admin/semaines')).data;
  } catch (err) {
    msg.value = { ok: false, text: err.response?.data?.error || "Erreur lors de l'import." };
  } finally {
    importing.value = false;
    e.target.value = '';
  }
}

async function remove(c) {
  if (!confirm(`Supprimer ${c.prenom} ${c.nom} ? Ses parents et données associées seront aussi supprimés.`)) return;
  msg.value = null;
  try {
    await axios.delete(`/api/admin/campeurs/${c.id}`);
    msg.value = { ok: true, text: `✓ ${c.prenom} ${c.nom} supprimé.` };
    await load();
  } catch (err) {
    msg.value = { ok: false, text: err.response?.data?.error || 'Erreur lors de la suppression.' };
  }
}
</script>
