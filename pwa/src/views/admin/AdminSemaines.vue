<template>
  <div class="space-y-4 max-w-3xl mx-auto">
    <!-- Liste des semaines -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 class="font-semibold text-sm">Semaines existantes</h2>
      <p v-if="semaines && !semaines.length" class="text-xs text-gray-500">Aucune semaine créée pour l'instant.</p>

      <div v-for="s in semaines" :key="s.id" class="border border-gray-800 rounded-lg p-3">
        <!-- Mode lecture -->
        <div v-if="editId !== s.id" class="flex items-center justify-between gap-2">
          <div>
            <div class="text-sm font-medium">{{ s.nom }}</div>
            <div class="text-xs text-gray-500">
              {{ fmt(s.dateDebut) }} → {{ fmt(s.dateFin) }} · {{ s._count.campeurs }} campeur(s)
            </div>
          </div>
          <div class="flex gap-2 shrink-0">
            <button @click="startEdit(s)" class="text-xs bg-gray-800 hover:bg-gray-700 rounded-lg px-3 py-1.5">✏️</button>
            <button @click="remove(s)" class="text-xs bg-gray-800 hover:bg-red-900 rounded-lg px-3 py-1.5">🗑️</button>
          </div>
        </div>

        <!-- Mode édition -->
        <div v-else class="space-y-2">
          <input v-model="editForm.nom" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
          <div class="flex gap-2">
            <input type="date" v-model="editForm.dateDebut" class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
            <input type="date" v-model="editForm.dateFin" :min="editForm.dateDebut" class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div class="flex gap-2">
            <button @click="saveEdit(s.id)" class="flex-1 bg-blue-700 hover:bg-blue-600 rounded-lg py-1.5 text-xs font-semibold">Enregistrer</button>
            <button @click="editId = null" class="flex-1 bg-gray-800 hover:bg-gray-700 rounded-lg py-1.5 text-xs">Annuler</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Créer une semaine -->
    <div class="bg-gray-900 rounded-xl p-4 space-y-3">
      <h2 class="font-semibold text-sm">Créer une semaine</h2>
      <input
        v-model="form.nom"
        placeholder="Nom (ex: Semaine 1)"
        class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
      />
      <div class="flex gap-2">
        <div class="flex-1 space-y-1">
          <label class="text-xs text-gray-400">Début</label>
          <input type="date" v-model="form.dateDebut" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div class="flex-1 space-y-1">
          <label class="text-xs text-gray-400">Fin</label>
          <input type="date" v-model="form.dateFin" :min="form.dateDebut" class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <p v-if="form.dateDebut && form.dateFin" class="text-xs text-blue-300 text-center">
        📅 {{ fmtIso(form.dateDebut) }} → {{ fmtIso(form.dateFin) }} ({{ nbJours }} jour{{ nbJours > 1 ? 's' : '' }})
      </p>
      <button
        @click="create"
        :disabled="!form.nom || !form.dateDebut || !form.dateFin"
        class="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded-lg py-2 text-sm font-semibold"
      >
        Créer la semaine
      </button>
    </div>

    <p v-if="msg" :class="msg.ok ? 'text-green-400' : 'text-red-400'" class="text-sm text-center">{{ msg.text }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';

const semaines = ref(null);
const form = ref({ nom: '', dateDebut: '', dateFin: '' });
const editId = ref(null);
const editForm = ref({});
const msg = ref(null);

onMounted(load);

async function load() {
  semaines.value = (await axios.get('/api/admin/semaines')).data;
}

const nbJours = computed(() => {
  if (!form.value.dateDebut || !form.value.dateFin) return 0;
  const diff = new Date(`${form.value.dateFin}T00:00:00`) - new Date(`${form.value.dateDebut}T00:00:00`);
  return Math.round(diff / 86_400_000) + 1;
});

function fmt(d) {
  return new Date(d).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtIso(d) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' });
}
// DateTime ISO → valeur input date (YYYY-MM-DD)
function toInputDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

async function create() {
  msg.value = null;
  try {
    await axios.post('/api/admin/semaines', {
      nom: form.value.nom,
      dateDebut: new Date(`${form.value.dateDebut}T00:00:00`).toISOString(),
      dateFin: new Date(`${form.value.dateFin}T00:00:00`).toISOString(),
    });
    msg.value = { ok: true, text: `✓ Semaine « ${form.value.nom} » créée.` };
    form.value = { nom: '', dateDebut: '', dateFin: '' };
    await load();
  } catch (err) {
    msg.value = { ok: false, text: err.response?.data?.error || 'Erreur lors de la création.' };
  }
}

function startEdit(s) {
  editId.value = s.id;
  editForm.value = { nom: s.nom, dateDebut: toInputDate(s.dateDebut), dateFin: toInputDate(s.dateFin) };
}

async function saveEdit(id) {
  msg.value = null;
  try {
    await axios.put(`/api/admin/semaines/${id}`, {
      nom: editForm.value.nom,
      dateDebut: new Date(`${editForm.value.dateDebut}T00:00:00`).toISOString(),
      dateFin: new Date(`${editForm.value.dateFin}T00:00:00`).toISOString(),
    });
    editId.value = null;
    msg.value = { ok: true, text: '✓ Semaine mise à jour.' };
    await load();
  } catch (err) {
    msg.value = { ok: false, text: err.response?.data?.error || 'Erreur lors de la mise à jour.' };
  }
}

async function remove(s) {
  if (!confirm(`Supprimer « ${s.nom} » ?`)) return;
  msg.value = null;
  try {
    await axios.delete(`/api/admin/semaines/${s.id}`);
    msg.value = { ok: true, text: `✓ Semaine « ${s.nom} » supprimée.` };
    await load();
  } catch (err) {
    msg.value = { ok: false, text: err.response?.data?.error || 'Erreur lors de la suppression.' };
  }
}
</script>
