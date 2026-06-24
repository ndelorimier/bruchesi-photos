<template>
  <div class="space-y-4 max-w-3xl mx-auto">
    <!-- Import xlsx CampBrain -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 class="font-semibold text-sm">📥 Importer une semaine (fichier CampBrain .xlsx)</h2>
      <p class="text-xs text-gray-400">
        Choisis la semaine, puis dépose l'export CampBrain « Camper Applications ». Un aperçu s'affiche
        <b>avant</b> tout envoi. Les parents déjà connus ne sont pas réinvités (ils voient tous leurs enfants).
      </p>

      <select v-model="impSemaine" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
        <option value="">— Semaine de cet import —</option>
        <option v-for="s in semaines" :key="s.id" :value="s.id">{{ s.nom }}</option>
      </select>

      <label class="block w-full border border-dashed border-gray-700 rounded-lg p-4 text-center cursor-pointer hover:border-gray-500"
        :class="{ 'opacity-40 pointer-events-none': !impSemaine }">
        <input type="file" accept=".xlsx" class="hidden" @change="preview" />
        <span class="text-gray-400 text-sm">{{ impSemaine ? (busy ? 'Lecture…' : 'Choisir le fichier .xlsx') : 'Sélectionne d\'abord une semaine' }}</span>
      </label>

      <!-- Aperçu -->
      <div v-if="apercu" class="text-xs space-y-2 bg-gray-800 rounded-lg p-3">
        <p class="text-gray-300 font-medium">Aperçu pour « {{ apercu.semaine }} » ({{ apercu.total }} ligne(s)) :</p>
        <ul class="space-y-0.5 text-gray-400">
          <li>🆕 <b class="text-green-400">{{ apercu.campeursCrees }}</b> enfant(s) à créer<template v-if="apercu.campeursExistants"> · {{ apercu.campeursExistants }} déjà présent(s)</template></li>
          <li>👪 <b class="text-blue-300">{{ apercu.parentsLies }}</b> lien(s) parent à créer<template v-if="apercu.nouveauxParents"> · {{ apercu.nouveauxParents }} nouveau(x) courriel(s)</template></li>
          <li class="text-gray-500">ℹ️ Aucun courriel ne sera envoyé — les invitations s'envoient depuis l'onglet <b>Parents</b>.</li>
          <li v-if="apercu.sansParent">⚠️ {{ apercu.sansParent }} enfant(s) sans courriel parent</li>
        </ul>
        <div v-if="apercu.ignorees.length" class="text-red-400">
          {{ apercu.ignorees.length }} ligne(s) ignorée(s) :
          <span v-for="(ig, i) in apercu.ignorees.slice(0, 5)" :key="i">L{{ ig.ligne }} ({{ ig.raison }}){{ i < Math.min(apercu.ignorees.length, 5) - 1 ? ', ' : '' }}</span>
        </div>
        <button @click="commit" :disabled="busy"
          class="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-lg py-2 text-sm font-semibold mt-1">
          {{ busy ? 'Import en cours…' : '✓ Confirmer l\'import (aucun courriel envoyé)' }}
        </button>
      </div>

      <p v-if="impMsg" :class="impMsg.ok ? 'text-green-400' : 'text-red-400'" class="text-sm">{{ impMsg.text }}</p>
    </div>

    <!-- Ajout manuel -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 class="font-semibold text-sm">➕ Ajouter un enfant manuellement</h2>
      <div class="flex gap-2">
        <input v-model="man.prenom" placeholder="Prénom" class="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
        <input v-model="man.nom" placeholder="Nom" class="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
      </div>
      <select v-model="man.semaineId" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
        <option value="">— Semaine —</option>
        <option v-for="s in semaines" :key="s.id" :value="s.id">{{ s.nom }}</option>
      </select>
      <div class="flex gap-2">
        <input v-model="man.parentPrenom" placeholder="Prénom du parent (optionnel)" class="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
        <input v-model="man.parentEmail" type="email" placeholder="Courriel du parent" class="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
      </div>
      <button @click="addManuel" :disabled="manBusy || !man.prenom || !man.nom || !man.semaineId"
        class="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-lg py-2 text-sm font-semibold">
        {{ manBusy ? 'Ajout…' : 'Ajouter l\'enfant' }}
      </button>
      <p v-if="manMsg" :class="manMsg.ok ? 'text-green-400' : 'text-red-400'" class="text-sm">{{ manMsg.text }}</p>
    </div>

    <!-- Liste -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold text-sm">Campeurs <span v-if="campeurs" class="text-gray-500 font-normal">({{ campeurs.length }})</span></h2>
        <select v-model="filtreSemaine" @change="load" class="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs">
          <option value="">Toutes les semaines</option>
          <option v-for="s in semaines" :key="s.id" :value="s.id">{{ s.nom }}</option>
        </select>
      </div>
      <input v-model="recherche" placeholder="🔍 Rechercher un campeur…" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';

const semaines = ref([]);
const campeurs = ref(null);
const filtreSemaine = ref('');
const recherche = ref('');

// Import
const impSemaine = ref('');
const fichier = ref(null);
const apercu = ref(null);
const busy = ref(false);
const impMsg = ref(null);

// Ajout manuel
const man = ref({ prenom: '', nom: '', semaineId: '', parentPrenom: '', parentEmail: '' });
const manBusy = ref(false);
const manMsg = ref(null);

onMounted(async () => {
  semaines.value = (await axios.get('/api/admin/semaines')).data;
  await load();
});

async function load() {
  const params = filtreSemaine.value ? { semaine: filtreSemaine.value } : {};
  campeurs.value = (await axios.get('/api/campeurs', { params })).data;
}

// Aperçu (commit=false) au choix du fichier
async function preview(e) {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f || !impSemaine.value) return;
  fichier.value = f;
  apercu.value = null;
  impMsg.value = null;
  busy.value = true;
  try {
    const form = new FormData();
    form.append('file', f);
    form.append('semaineId', impSemaine.value);
    apercu.value = (await axios.post('/api/admin/import-xlsx', form)).data;
  } catch (err) {
    impMsg.value = { ok: false, text: err.response?.data?.error || 'Erreur de lecture du fichier.' };
  } finally {
    busy.value = false;
  }
}

// Import réel (commit=true)
async function commit() {
  if (!fichier.value || !impSemaine.value) return;
  busy.value = true;
  impMsg.value = null;
  try {
    const form = new FormData();
    form.append('file', fichier.value);
    form.append('semaineId', impSemaine.value);
    form.append('commit', 'true');
    const r = (await axios.post('/api/admin/import-xlsx', form)).data;
    impMsg.value = { ok: true, text: `✓ ${r.campeursCrees} enfant(s), ${r.parentsLies} parent(s) créés. Envoie les invitations depuis l'onglet Parents.` };
    apercu.value = null;
    fichier.value = null;
    await load();
  } catch (err) {
    impMsg.value = { ok: false, text: err.response?.data?.error || 'Erreur lors de l\'import.' };
  } finally {
    busy.value = false;
  }
}

async function addManuel() {
  manBusy.value = true;
  manMsg.value = null;
  try {
    const body = {
      prenom: man.value.prenom, nom: man.value.nom, semaineId: Number(man.value.semaineId),
      parents: man.value.parentEmail ? [{ prenom: man.value.parentPrenom, email: man.value.parentEmail }] : [],
    };
    const r = (await axios.post('/api/admin/campeurs', body)).data;
    manMsg.value = { ok: true, text: `✓ ${man.value.prenom} ${man.value.nom} ${r.dejaExistant ? 'déjà présent' : 'ajouté'}. Invitation à envoyer depuis l'onglet Parents.` };
    man.value = { prenom: '', nom: '', semaineId: '', parentPrenom: '', parentEmail: '' };
    await load();
  } catch (err) {
    manMsg.value = { ok: false, text: err.response?.data?.error || 'Erreur lors de l\'ajout.' };
  } finally {
    manBusy.value = false;
  }
}

const campeursFiltres = computed(() => {
  if (!campeurs.value) return [];
  const q = recherche.value.trim().toLowerCase();
  if (!q) return campeurs.value;
  return campeurs.value.filter((c) => `${c.prenom} ${c.nom}`.toLowerCase().includes(q));
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

async function remove(c) {
  if (!confirm(`Supprimer ${c.prenom} ${c.nom} ? Ses parents et données associées seront aussi supprimés.`)) return;
  try {
    await axios.delete(`/api/admin/campeurs/${c.id}`);
    await load();
  } catch (err) {
    alert(err.response?.data?.error || 'Erreur lors de la suppression.');
  }
}
</script>
