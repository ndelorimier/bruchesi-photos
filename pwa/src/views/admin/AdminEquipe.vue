<template>
  <div class="space-y-4 max-w-3xl mx-auto">
    <!-- Liste des employés -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 class="font-semibold text-sm">Équipe <span v-if="employes" class="text-gray-500 font-normal">({{ employes.length }})</span></h2>

      <div v-for="e in employes" :key="e.id" class="border border-gray-800 rounded-lg p-3 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-sm font-medium truncate">
              {{ e.prenom }} {{ e.nom }}
              <span v-if="e.id === monId" class="text-[10px] text-blue-400">(moi)</span>
            </div>
            <div class="text-xs text-gray-500 truncate">{{ e.email }}</div>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded-full shrink-0" :class="badgeRole(e.role)">{{ libRole(e.role) }}</span>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <select
            :value="e.role"
            @change="changeRole(e, $event.target.value)"
            class="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 flex-1"
          >
            <option value="PHOTOGRAPHE">📷 Photographe</option>
            <option value="APPROBATEUR">✅ Approbateur</option>
            <option value="ADMIN">⚙️ Admin</option>
          </select>
          <button
            @click="remove(e)"
            :disabled="e.id === monId"
            class="bg-gray-800 hover:bg-red-900 disabled:opacity-30 rounded-lg px-3 py-1.5"
          >🗑️</button>
        </div>
      </div>
    </div>

    <!-- Créer un employé -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 class="font-semibold text-sm">Ajouter un membre</h2>
      <div class="flex gap-2">
        <input v-model="form.prenom" placeholder="Prénom" class="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
        <input v-model="form.nom" placeholder="Nom" class="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
      </div>
      <input v-model="form.email" type="email" placeholder="email@bruchesi.com" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
      <div class="flex gap-2">
        <select v-model="form.role" class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm">
          <option value="PHOTOGRAPHE">📷 Photographe</option>
          <option value="APPROBATEUR">✅ Approbateur</option>
          <option value="ADMIN">⚙️ Admin</option>
        </select>
        <input v-model="form.password" type="text" placeholder="Mot de passe (8+ car.)" class="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
      </div>
      <button
        @click="create"
        :disabled="!form.email || !form.prenom || !form.nom || form.password.length < 8"
        class="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-lg py-2 text-sm font-semibold"
      >
        Créer le compte
      </button>
    </div>

    <!-- Mon mot de passe -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 class="font-semibold text-sm">🔑 Changer mon mot de passe</h2>
      <input v-model="pwd.current" type="password" placeholder="Mot de passe actuel"
        class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
      <input v-model="pwd.next" type="password" placeholder="Nouveau mot de passe (8 car. min.)"
        class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
      <input v-model="pwd.confirm" type="password" placeholder="Confirmer le nouveau mot de passe"
        class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
      <button @click="changePassword"
        class="w-full bg-indigo-700 hover:bg-indigo-600 rounded-lg py-2 text-sm font-semibold">
        Mettre à jour
      </button>
    </div>

    <p v-if="msg" :class="msg.ok ? 'text-green-400' : 'text-red-400'" class="text-sm text-center">{{ msg.text }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const monId = computed(() => auth.user?.id);

const employes = ref(null);
const form = ref({ prenom: '', nom: '', email: '', role: 'PHOTOGRAPHE', password: '' });
const pwd = ref({ current: '', next: '', confirm: '' });
const msg = ref(null);

onMounted(load);

async function load() {
  employes.value = (await axios.get('/api/admin/employes')).data;
}

function badgeRole(r) {
  if (r === 'ADMIN') return 'bg-purple-900 text-purple-300';
  if (r === 'APPROBATEUR') return 'bg-green-900 text-green-300';
  return 'bg-blue-900 text-blue-300';
}
function libRole(r) {
  if (r === 'ADMIN') return 'Admin';
  if (r === 'APPROBATEUR') return 'Approbateur';
  return 'Photographe';
}

async function create() {
  msg.value = null;
  try {
    await axios.post('/api/admin/employes', form.value);
    msg.value = { ok: true, text: `✓ Compte ${form.value.email} créé.` };
    form.value = { prenom: '', nom: '', email: '', role: 'PHOTOGRAPHE', password: '' };
    await load();
  } catch (err) {
    msg.value = { ok: false, text: err.response?.data?.error || 'Erreur lors de la création.' };
  }
}

async function changeRole(e, role) {
  if (role === e.role) return;
  msg.value = null;
  try {
    await axios.put(`/api/admin/employes/${e.id}`, { role });
    msg.value = { ok: true, text: `✓ ${e.prenom} est maintenant ${libRole(role)}.` };
    await load();
  } catch (err) {
    msg.value = { ok: false, text: err.response?.data?.error || 'Erreur lors du changement de rôle.' };
    await load(); // remettre le select à la vraie valeur
  }
}

async function remove(e) {
  if (!confirm(`Supprimer le compte de ${e.prenom} ${e.nom} ?`)) return;
  msg.value = null;
  try {
    await axios.delete(`/api/admin/employes/${e.id}`);
    msg.value = { ok: true, text: `✓ Compte supprimé.` };
    await load();
  } catch (err) {
    msg.value = { ok: false, text: err.response?.data?.error || 'Erreur lors de la suppression.' };
  }
}

async function changePassword() {
  msg.value = null;
  if (pwd.value.next !== pwd.value.confirm) {
    msg.value = { ok: false, text: 'Les nouveaux mots de passe ne correspondent pas.' };
    return;
  }
  try {
    await axios.put('/api/employes/password', {
      currentPassword: pwd.value.current,
      newPassword: pwd.value.next,
    });
    msg.value = { ok: true, text: '✓ Mot de passe mis à jour.' };
    pwd.value = { current: '', next: '', confirm: '' };
  } catch (err) {
    msg.value = { ok: false, text: err.response?.data?.error || 'Erreur lors de la mise à jour.' };
  }
}
</script>
