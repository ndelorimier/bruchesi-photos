<template>
  <div class="min-h-screen bg-gray-950 text-white p-4 space-y-6">
    <h1 class="font-bold text-xl">⚙️ Administration</h1>

    <!-- Dashboard -->
    <div v-if="dashboard" class="grid grid-cols-2 gap-3">
      <div class="bg-gray-900 rounded-xl p-4 text-center">
        <div class="text-2xl font-bold text-green-400">{{ dashboard.approvedPhotos }}</div>
        <div class="text-xs text-gray-400 mt-1">Photos approuvées</div>
      </div>
      <div class="bg-gray-900 rounded-xl p-4 text-center">
        <div class="text-2xl font-bold text-orange-400">{{ dashboard.pendingPhotos }}</div>
        <div class="text-xs text-gray-400 mt-1">En attente</div>
      </div>
      <div v-for="s in dashboard.campeurs" :key="s.statut" class="bg-gray-900 rounded-xl p-4 text-center">
        <div class="text-2xl font-bold text-blue-400">{{ s._count }}</div>
        <div class="text-xs text-gray-400 mt-1">Campeurs {{ s.statut.toLowerCase() }}</div>
      </div>
    </div>

    <!-- Import CSV -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 class="font-semibold">Import CSV campeurs</h2>
      <p class="text-xs text-gray-400">Format: prenom_enfant, nom_enfant, semaine, prenom_parent, email_parent</p>
      <label class="block w-full border border-dashed border-gray-700 rounded-lg p-4 text-center cursor-pointer">
        <input type="file" accept=".csv" class="hidden" @change="importCsv" />
        <span class="text-gray-400 text-sm">Sélectionner un fichier CSV</span>
      </label>
      <p v-if="csvResult" class="text-green-400 text-sm">{{ csvResult }}</p>
    </div>

    <!-- Semaines -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 class="font-semibold">Créer une semaine</h2>
      <input v-model="newSemaine.nom" placeholder="Nom (ex: Semaine 1)" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
      <input v-model="newSemaine.dateDebut" type="date" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
      <input v-model="newSemaine.dateFin" type="date" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
      <button @click="createSemaine" class="w-full bg-blue-700 hover:bg-blue-600 rounded-lg py-2 text-sm font-semibold">Créer la semaine</button>
    </div>

    <!-- Changer mot de passe -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 class="font-semibold">🔑 Changer mon mot de passe</h2>
      <input v-model="pwd.current" type="password" placeholder="Mot de passe actuel"
        class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
      <input v-model="pwd.next" type="password" placeholder="Nouveau mot de passe (8 car. min.)"
        class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
      <input v-model="pwd.confirm" type="password" placeholder="Confirmer le nouveau mot de passe"
        class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
      <button @click="changePassword"
        class="w-full bg-indigo-700 hover:bg-indigo-600 rounded-lg py-2 text-sm font-semibold">
        Mettre à jour
      </button>
      <p v-if="pwdMsg" :class="pwdMsg.ok ? 'text-green-400' : 'text-red-400'" class="text-sm text-center">
        {{ pwdMsg.text }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const dashboard = ref(null);
const csvResult = ref('');
const newSemaine = ref({ nom: '', dateDebut: '', dateFin: '' });
const pwd = ref({ current: '', next: '', confirm: '' });
const pwdMsg = ref(null);

onMounted(async () => {
  dashboard.value = (await axios.get('/api/admin/dashboard')).data;
});

async function importCsv(e) {
  const form = new FormData();
  form.append('file', e.target.files[0]);
  const res = await axios.post('/api/admin/import-csv', form);
  csvResult.value = `${res.data.created} parent(s) créés sur ${res.data.total} lignes.`;
}

async function createSemaine() {
  await axios.post('/api/admin/semaines', newSemaine.value);
  newSemaine.value = { nom: '', dateDebut: '', dateFin: '' };
  dashboard.value = (await axios.get('/api/admin/dashboard')).data;
}

async function changePassword() {
  pwdMsg.value = null;
  if (pwd.value.next !== pwd.value.confirm) {
    pwdMsg.value = { ok: false, text: 'Les nouveaux mots de passe ne correspondent pas.' };
    return;
  }
  try {
    await axios.put('/api/employes/password', {
      currentPassword: pwd.value.current,
      newPassword: pwd.value.next,
    });
    pwdMsg.value = { ok: true, text: '✓ Mot de passe mis à jour.' };
    pwd.value = { current: '', next: '', confirm: '' };
  } catch (err) {
    pwdMsg.value = { ok: false, text: err.response?.data?.error || 'Erreur lors de la mise à jour.' };
  }
}
</script>
