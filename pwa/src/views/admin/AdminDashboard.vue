<template>
  <div class="space-y-6 max-w-3xl mx-auto">
    <div v-if="!data" class="text-gray-500 text-sm text-center py-8">Chargement…</div>

    <template v-else>
      <!-- Totaux -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-gray-900 rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-green-400">{{ data.totaux.approved }}</div>
          <div class="text-xs text-gray-400 mt-1">Photos approuvées</div>
        </div>
        <div class="bg-gray-900 rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-orange-400">{{ data.totaux.pending }}</div>
          <div class="text-xs text-gray-400 mt-1">En attente</div>
        </div>
        <div class="bg-gray-900 rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-blue-400">{{ data.totaux.campeurs }}</div>
          <div class="text-xs text-gray-400 mt-1">Campeurs</div>
        </div>
        <div class="bg-gray-900 rounded-xl p-4 text-center">
          <div class="text-2xl font-bold text-purple-400">{{ data.totaux.parentsActifs }}<span class="text-sm text-gray-500">/{{ data.totaux.parents }}</span></div>
          <div class="text-xs text-gray-400 mt-1">Parents actifs</div>
        </div>
      </div>

      <!-- Santé système -->
      <div class="bg-gray-900 rounded-xl p-4 space-y-2">
        <h2 class="font-semibold text-sm">🩺 Santé du système</h2>
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="px-2 py-1 rounded-full" :class="santeCompreface.cls">
            {{ santeCompreface.txt }}
          </span>
          <span class="px-2 py-1 rounded-full" :class="data.sante.smtp ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'">
            {{ data.sante.smtp ? '✓ Email configuré' : '✗ Email non configuré' }}
          </span>
          <span v-if="data.sante.disque" class="px-2 py-1 rounded-full bg-gray-800 text-gray-300">
            💾 {{ data.sante.disque.libreGo }} Go libres / {{ data.sante.disque.totalGo }} Go
          </span>
        </div>
      </div>

      <!-- Par semaine -->
      <div class="bg-gray-900 rounded-xl p-4 space-y-3">
        <h2 class="font-semibold text-sm">📅 Par semaine</h2>
        <p v-if="!data.semaines.length" class="text-xs text-gray-500">
          Aucune semaine. <router-link to="/admin/semaines" class="text-blue-400">Créer la première →</router-link>
        </p>
        <div v-for="s in data.semaines" :key="s.id" class="border border-gray-800 rounded-lg p-3 space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-medium text-sm">{{ s.nom }}</span>
            <span v-if="enCours(s)" class="text-[10px] bg-green-900 text-green-300 px-2 py-0.5 rounded-full">En cours</span>
            <span v-else class="text-[10px] text-gray-500">{{ fmtCourt(s.dateDebut) }} → {{ fmtCourt(s.dateFin) }}</span>
          </div>
          <div class="grid grid-cols-4 gap-2 text-center text-xs">
            <div><div class="font-bold text-blue-300">{{ s.nbCampeurs }}</div><div class="text-gray-500">campeurs</div></div>
            <div><div class="font-bold" :class="s.nbConfirmes === s.nbCampeurs && s.nbCampeurs > 0 ? 'text-green-300' : 'text-yellow-300'">{{ s.nbConfirmes }}</div><div class="text-gray-500">enrôlés</div></div>
            <div><div class="font-bold text-purple-300">{{ s.nbParentsActifs }}/{{ s.nbParents }}</div><div class="text-gray-500">parents</div></div>
            <div><div class="font-bold text-pink-300">{{ s.nbPhotos }}</div><div class="text-gray-500">photos</div></div>
          </div>
        </div>
      </div>

      <!-- Activité récente -->
      <div class="bg-gray-900 rounded-xl p-4 space-y-2">
        <h2 class="font-semibold text-sm">🕐 Activité récente</h2>
        <p v-if="!data.activite.length" class="text-xs text-gray-500">Aucune photo pour l'instant.</p>
        <div v-for="p in data.activite" :key="p.id" class="flex items-center justify-between text-xs border-b border-gray-800 last:border-0 py-2">
          <div class="space-y-0.5">
            <div class="text-gray-300">
              📷 par {{ p.uploadedBy.prenom }} {{ p.uploadedBy.nom }}
              <span class="text-gray-500">· {{ p._count.tags }} visage(s)</span>
            </div>
            <div class="text-gray-500">{{ fmtDateHeure(p.uploadedAt) }}<template v-if="p.approuvePar"> · validée par {{ p.approuvePar.prenom }}</template></div>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px]" :class="badgeStatut(p.statut)">{{ libStatut(p.statut) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';

const data = ref(null);

onMounted(async () => {
  data.value = (await axios.get('/api/admin/dashboard')).data;
});

const santeCompreface = computed(() => {
  const v = data.value?.sante.compreface;
  if (v === 'ok') return { txt: '✓ Reconnaissance faciale', cls: 'bg-green-900 text-green-300' };
  if (v === 'non-configure') return { txt: '⚠ Reconnaissance à configurer', cls: 'bg-yellow-900 text-yellow-300' };
  return { txt: '✗ Reconnaissance injoignable', cls: 'bg-red-900 text-red-300' };
});

function enCours(s) {
  const now = new Date();
  return new Date(s.dateDebut) <= now && now <= new Date(s.dateFin);
}
function fmtCourt(d) {
  return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
}
function fmtDateHeure(d) {
  return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function badgeStatut(s) {
  if (s === 'APPROVED') return 'bg-green-900 text-green-300';
  if (s === 'REJECTED') return 'bg-red-900 text-red-300';
  return 'bg-orange-900 text-orange-300';
}
function libStatut(s) {
  if (s === 'APPROVED') return 'Approuvée';
  if (s === 'REJECTED') return 'Rejetée';
  return 'En attente';
}
</script>
