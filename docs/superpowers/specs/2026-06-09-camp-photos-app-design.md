# Bruchési Photos — Design Spec
**Date :** 2026-06-09  
**Statut :** Approuvé — prêt pour implémentation  
**Projet :** Application photos de camp style Waldo Photos, hébergée sur NAS Synology DS1520+

---

## 1. Contexte et objectifs

Application web progressive (PWA) permettant aux parents de recevoir des notifications et d'accéder aux photos de leur enfant au camp Bruchési. La reconnaissance faciale automatise le tri des photos par enfant. Tous les composants sont hébergés sur le NAS Synology du camp.

**Contraintes clés :**
- ~100 campeurs/semaine, 8 semaines d'été, ~50 photos/jour
- Données et photos ne quittent jamais le camp (Loi 25 Québec, vie privée enfants mineurs)
- NAS : Synology DS1520+ (Celeron J4125, 8 GB RAM, Docker/Container Manager disponible)
- Application autonome — pas de connexion au Portail Bruchési existant
- Phase 2 prévue : migration vers app native iOS/Android (App Store/Google Play)

---

## 2. Architecture

### Déploiement
Full Docker Compose sur le DS1520+. Un seul fichier `docker-compose.yml` orchestre tous les services.

```
NAS DS1520+
├── nginx          → Reverse proxy HTTPS + serve PWA static (port 443/80)
├── app            → Node.js/Express API (port 3000, interne)
├── postgres       → PostgreSQL 15 (port 5432, interne)
├── compreface     → Reconnaissance faciale open-source (port 8000, interne)
└── /photos/       → Volume NAS natif (pending/, approved/, profiles/)
```

**Accès réseau :** Domaine dédié (ex. `photos.bruchesi.com`) via DDNS Synology ou DNS externe → port 443 ouvert sur routeur → nginx. PostgreSQL et CompreFace non exposés à l'extérieur.

**SSH :** Port 22 activé sur le NAS — utilisé pour déploiement et maintenance.

### Stack technique

| Couche | Technologie |
|--------|-------------|
| Backend API | Node.js + Express + Prisma ORM |
| Frontend PWA | Vue.js 3 + Vite + vite-plugin-pwa + Tailwind CSS |
| Base de données | PostgreSQL 15 |
| Reconnaissance faciale | CompreFace (Docker, open-source) |
| Proxy / SSL | Nginx + Let's Encrypt (certbot) |
| Push notifications | Web Push API — librairie `web-push` (VAPID) |
| Email (magic links) | Nodemailer + Brevo SMTP |
| Déploiement | Docker Compose, fichiers sync via Synology Drive |

---

## 3. Modèle de données

### Gestion du camp
```sql
semaines        (id, nom, date_debut, date_fin)
campeurs        (id, prenom, nom, semaine_id→semaines, compreface_subject_id,
                 statut: aucun|partiel|confirmé)
parents         (id, email, prenom, nom, campeur_id→campeurs, compte_actif)
employes        (id, email, prenom, nom, role: photographe|approbateur|admin)
```

### Photos et reconnaissance faciale
```sql
photos          (id, fichier_path, thumbnail_path, uploaded_by→employes,
                 uploaded_at, statut: pending|approved|rejected,
                 approuve_par→employes, approuve_at)
photo_tags      (photo_id→photos, campeur_id→campeurs,
                 confidence FLOAT, confirme_par_humain BOOL)
face_profiles   (campeur_id→campeurs, type: parent_submit|selfie_station,
                 fichier_path, enregistre_at)
```

### Auth et notifications
```sql
magic_links         (token UUID, parent_id→parents, expires_at, used_at)
push_subscriptions  (parent_id→parents, endpoint, p256dh, auth)
notifications       (parent_id→parents, photo_id→photos, type: new_photo, sent_at)
```

**Import CSV :** Format `prenom_enfant, nom_enfant, semaine, prenom_parent, email_parent`. Un enfant peut avoir 2 parents (2 lignes). Import idempotent.

**Parent avec plusieurs enfants :** Un même email parent peut apparaître sur plusieurs lignes (enfants différents). Le système crée une ligne `parents` par enfant, mais les push subscriptions sont dédupliquées par email — un parent reçoit une seule notification même si ses deux enfants sont dans la même photo approuvée.

---

## 4. Flux principaux

### ① Enrôlement campeur
1. Admin importe CSV → comptes campeurs/parents créés
2. Email avec magic link envoyé automatiquement à chaque parent
3. Parent clique → connecté → uploade photo de référence de son enfant
4. Admin valide la photo → CompreFace : sujet créé, 1ère image de référence → `statut: partiel`
5. Employé (selfie station, jour 1) → cherche l'enfant par nom → prend photo
6. CompreFace : 2ème image ajoutée → `statut: confirmé`

### ② Upload → Approbation → Tags
1. Employé uploade batch de photos (desktop drag & drop ou mobile)
2. Photos créées avec `statut: pending`
3. Queue async : CompreFace analyse chaque photo, génère `photo_tags` avec confidence
4. Approbateur voit les photos pending avec tags proposés (noms + pourcentage de confiance)
5. Approbateur peut corriger les tags (ajouter/retirer) puis approuve ou rejette
6. Sur approbation : `statut → approved`, photo visible dans l'album de la semaine concernée

**Photos sans visage détecté :** Si CompreFace ne trouve aucun visage (paysage, activité distante), la photo apparaît en file d'approbation sans aucun tag proposé. L'approbateur peut l'approuver telle quelle (photo générale du camp, visible dans l'album de la semaine sans notification push individuelle) ou la rejeter.

### ③ Notification et accès parent
1. Sur chaque photo approuvée : identifier les parents des campeurs tagués
2. Envoyer push notification Web Push : *"📸 Nouvelle photo de [Prénom] !"*
3. Parent ouvre l'app → voit uniquement les photos de la semaine de son enfant
4. Téléchargement individuel ou ZIP de la semaine disponible

**Sécurité :** Le filtre par semaine est enforced côté API — impossible à contourner côté frontend.

---

## 5. Interfaces (4 vues)

### Vue parent (PWA mobile)
- Galerie photos de la semaine de l'enfant (grille)
- Bouton téléchargement ZIP
- Onglet alertes (historique notifications)
- Onglet profil (photo de référence, préférences notifications)

### Vue approbation (employé, mobile/tablette)
- Liste des photos pending avec tags IA proposés et % de confiance
- Actions par photo : approuver ✓ / rejeter ✗ / corriger les tags
- Bouton "Tout approuver" pour les batches sans ambiguïté
- Badge compteur photos en attente

### Selfie Station (tablette, employé)
- Recherche campeur par nom
- Fiche campeur : état d'enrôlement (photo parent ✓/✗, selfie ✓/✗)
- Prévisualisation caméra en temps réel
- Bouton capture → enrôlement CompreFace automatique

### Vue admin (desktop)
- Import CSV campeurs/parents
- Gestion des semaines
- Dashboard : photos approuvées/en attente, campeurs enrôlés/confirmés
- Liste parents avec statut de connexion (jamais connecté / actif)

---

## 6. Traitement asynchrone (queue photos)

Le DS1520+ traite les visages sur CPU (~1-3 sec/photo). Avec ~50 photos/jour, la queue est non-bloquante :

- Upload → photo sauvegardée immédiatement, statut `pending`
- Worker Node.js (setInterval ou bull queue) : dépile et appelle CompreFace
- Résultats écrits dans `photo_tags`
- L'approbateur voit le tag complété dans la minute suivant l'upload

---

## 7. Sécurité et vie privée

- Photos d'enfants mineurs — aucune donnée ne quitte le NAS (CompreFace local)
- Conformité Loi 25 (Québec) : consentement parental via inscription au camp
- JWT sessions courtes (24h) pour les parents
- Magic links à usage unique, expiration 7 jours — un parent peut redemander un lien via l'écran de connexion (entrer son email → nouveau lien envoyé automatiquement si l'email est dans le système)
- Employés authentifiés séparément (email + mot de passe hashé bcrypt)
- CompreFace et PostgreSQL non exposés sur le réseau externe

---

## 8. Phase 2 — App native (prévu, hors scope initial)

L'architecture PWA est conçue pour être native-ready :
- API REST découplée du frontend → la même API servira l'app native
- Push VAPID → migration vers FCM/APNs (React Native / Expo)
- Authentification JWT identique
- Prévoir comptes développeur Apple ($99/an) et Google Play ($25 une fois)

---

## 9. Hors scope (v1)

- Intégration avec le Portail Bruchési (Railway) — autonome uniquement
- Reconnaissance faciale de groupe (photos avec >10 visages simultanés)
- Partage social des photos par les parents
- Vidéos
- App native iOS/Android (phase 2)
