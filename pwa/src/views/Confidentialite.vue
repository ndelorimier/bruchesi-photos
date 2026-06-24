<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <div class="bg-gray-900 px-4 py-4 sticky top-0 z-10">
      <h1 class="font-bold text-lg">Politique de confidentialité</h1>
      <p class="text-xs text-gray-400">Bruchési Photos — protection des renseignements personnels</p>
    </div>

    <div class="max-w-2xl mx-auto p-4 space-y-5 text-sm text-gray-300 leading-relaxed pb-16">
      <div class="bg-yellow-900/30 border border-yellow-800 rounded-lg p-3 text-xs text-yellow-200">
        ⚠️ Brouillon à faire valider par une personne responsable juridiquement avant la mise en service avec de vraies données. Les coordonnées et délais ci-dessous sont à confirmer.
      </div>

      <section>
        <h2 class="font-semibold text-white mb-1">1. Qui est responsable</h2>
        <p>Le Camp Bruchési est responsable des renseignements personnels recueillis via l'application Bruchési Photos. Pour toute question ou pour exercer vos droits, contactez le responsable de la protection des renseignements personnels : <span class="text-gray-400">[courriel / téléphone à compléter]</span>.</p>
      </section>

      <section>
        <h2 class="font-semibold text-white mb-1">2. Renseignements recueillis</h2>
        <ul class="list-disc pl-5 space-y-1">
          <li>Identité de l'enfant (prénom, nom) et la semaine de camp.</li>
          <li>Coordonnées du parent (prénom, courriel).</li>
          <li>Photos prises durant les activités du camp.</li>
          <li><b>Données biométriques</b> : empreintes faciales générées à partir des photos, <b>uniquement si vous y consentez</b>, pour identifier automatiquement votre enfant.</li>
        </ul>
      </section>

      <section>
        <h2 class="font-semibold text-white mb-1">3. Finalités</h2>
        <p>Ces renseignements servent à : partager avec vous les photos de votre enfant, vous aviser des nouvelles photos, et — avec votre consentement — associer automatiquement les photos au bon enfant par reconnaissance faciale.</p>
      </section>

      <section>
        <h2 class="font-semibold text-white mb-1">4. Consentement</h2>
        <p>Le traitement biométrique (reconnaissance faciale) repose sur votre <b>consentement explicite</b>, donné depuis votre profil. Vous pouvez le <b>retirer en tout temps</b> ; l'identification se fera alors manuellement par l'équipe.</p>
      </section>

      <section>
        <h2 class="font-semibold text-white mb-1">5. Traitement local</h2>
        <p>Les photos et les données biométriques sont traitées et conservées <b>localement, sur l'équipement du camp</b> (serveur et appareil de traitement sur place). Elles ne sont transmises à aucun service infonuagique tiers pour la reconnaissance faciale.</p>
      </section>

      <section>
        <h2 class="font-semibold text-white mb-1">6. Conservation et destruction</h2>
        <p>Les photos et les empreintes faciales sont conservées pour la durée nécessaire à la saison de camp, puis détruites automatiquement <span class="text-gray-400">[délai à confirmer, ex. à la fin de la saison]</span>. Les empreintes faciales d'un enfant sont supprimées dès le retrait du consentement.</p>
      </section>

      <section>
        <h2 class="font-semibold text-white mb-1">7. Vos droits</h2>
        <p>Vous pouvez demander l'accès, la rectification ou la suppression des renseignements de votre enfant, et retirer votre consentement. Pour exercer ces droits, contactez le responsable indiqué à la section 1.</p>
      </section>

      <section>
        <h2 class="font-semibold text-white mb-1">8. Sécurité</h2>
        <p>L'accès est protégé par mot de passe (équipe) ou lien sécurisé (parents), les échanges sont chiffrés (HTTPS), et chaque parent ne voit que les photos de son ou ses enfants.</p>
      </section>

      <div class="pt-2">
        <router-link to="/login" class="text-blue-400 text-sm">← Retour</router-link>
      </div>
    </div>
  </div>
</template>

<script setup></script>
