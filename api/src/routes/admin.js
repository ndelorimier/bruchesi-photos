const router = require('express').Router();
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const bcrypt = require('bcrypt');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { isNonEmptyString, isEmail, isValidDate, isId } = require('../middleware/validate');
const { sendMagicLink } = require('../services/email');
const compreface = require('../services/compreface');

const adminOnly = [requireAuth, requireRole('ADMIN')];
const ROLES = ['PHOTOGRAPHE', 'APPROBATEUR', 'ADMIN'];

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

// GET /api/admin/dashboard — stats globales, par semaine, activité récente, santé
router.get('/dashboard', ...adminOnly, async (req, res) => {
  try {
    const [totalPhotos, pendingPhotos, approvedPhotos, rejectedPhotos,
           totalCampeurs, totalParents, parentsActifs, semaines] = await Promise.all([
      prisma.photo.count(),
      prisma.photo.count({ where: { statut: 'PENDING' } }),
      prisma.photo.count({ where: { statut: 'APPROVED' } }),
      prisma.photo.count({ where: { statut: 'REJECTED' } }),
      prisma.campeur.count(),
      prisma.parent.count(),
      prisma.parent.count({ where: { compteActif: true } }),
      prisma.semaine.findMany({ orderBy: { dateDebut: 'asc' } }),
    ]);

    // Stats par semaine (peu de semaines — boucle acceptable)
    const parSemaine = await Promise.all(semaines.map(async (s) => {
      const [nbCampeurs, nbConfirmes, nbPartiels, nbParents, nbParentsActifs, nbPhotos] = await Promise.all([
        prisma.campeur.count({ where: { semaineId: s.id } }),
        prisma.campeur.count({ where: { semaineId: s.id, statut: 'CONFIRME' } }),
        prisma.campeur.count({ where: { semaineId: s.id, statut: 'PARTIEL' } }),
        prisma.parent.count({ where: { campeur: { semaineId: s.id } } }),
        prisma.parent.count({ where: { campeur: { semaineId: s.id }, compteActif: true } }),
        prisma.photo.count({ where: { tags: { some: { campeur: { semaineId: s.id } } } } }),
      ]);
      return { ...s, nbCampeurs, nbConfirmes, nbPartiels, nbParents, nbParentsActifs, nbPhotos };
    }));

    // Activité récente — 10 dernières photos
    const activite = await prisma.photo.findMany({
      take: 10,
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true, statut: true, uploadedAt: true, approuveAt: true,
        uploadedBy: { select: { prenom: true, nom: true } },
        approuvePar: { select: { prenom: true, nom: true } },
        _count: { select: { tags: true } },
      },
    });

    // Santé système
    const smtpConfigure = Boolean(process.env.SMTP_USER) && !process.env.SMTP_USER.includes('changeme');
    let disque = null;
    try {
      const st = await fs.promises.statfs(process.env.PHOTOS_PATH || '/data/photos');
      disque = {
        libreGo: Math.round((st.bavail * st.bsize) / 1e9 * 10) / 10,
        totalGo: Math.round((st.blocks * st.bsize) / 1e9 * 10) / 10,
      };
    } catch { /* statfs indisponible — on n'affiche rien */ }

    res.json({
      totaux: {
        photos: totalPhotos, pending: pendingPhotos, approved: approvedPhotos, rejected: rejectedPhotos,
        campeurs: totalCampeurs, parents: totalParents, parentsActifs,
      },
      semaines: parSemaine,
      activite,
      sante: { compreface: await compreface.ping(), smtp: smtpConfigure, disque },
    });
  } catch (err) {
    console.error('dashboard error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ---------------------------------------------------------------------------
// Semaines
// ---------------------------------------------------------------------------

function validerSemaine(body) {
  const { nom, dateDebut, dateFin } = body;
  if (!isNonEmptyString(nom)) return 'Le nom de la semaine est requis.';
  if (!isValidDate(dateDebut) || !isValidDate(dateFin)) return 'Dates de début et de fin requises.';
  if (new Date(dateFin) < new Date(dateDebut)) return 'La date de fin doit être après la date de début.';
  return null;
}

// GET /api/admin/semaines — avec compte de campeurs
router.get('/semaines', ...adminOnly, async (req, res) => {
  try {
    const semaines = await prisma.semaine.findMany({
      orderBy: { dateDebut: 'asc' },
      include: { _count: { select: { campeurs: true } } },
    });
    res.json(semaines);
  } catch (err) {
    console.error('semaines GET error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/semaines  { nom, dateDebut, dateFin }
router.post('/semaines', ...adminOnly, async (req, res) => {
  try {
    const erreur = validerSemaine(req.body);
    if (erreur) return res.status(400).json({ error: erreur });
    const { nom, dateDebut, dateFin } = req.body;
    const semaine = await prisma.semaine.create({
      data: { nom: nom.trim(), dateDebut: new Date(dateDebut), dateFin: new Date(dateFin) },
    });
    res.status(201).json(semaine);
  } catch (err) {
    console.error('create semaine error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/semaines/:id  { nom, dateDebut, dateFin }
router.put('/semaines/:id', ...adminOnly, async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Id invalide' });
    const erreur = validerSemaine(req.body);
    if (erreur) return res.status(400).json({ error: erreur });
    const { nom, dateDebut, dateFin } = req.body;
    const semaine = await prisma.semaine.update({
      where: { id: Number(req.params.id) },
      data: { nom: nom.trim(), dateDebut: new Date(dateDebut), dateFin: new Date(dateFin) },
    });
    res.json(semaine);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Semaine introuvable' });
    console.error('update semaine error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/semaines/:id — refusé si des campeurs y sont rattachés
router.delete('/semaines/:id', ...adminOnly, async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Id invalide' });
    const id = Number(req.params.id);
    const nbCampeurs = await prisma.campeur.count({ where: { semaineId: id } });
    if (nbCampeurs > 0) {
      return res.status(409).json({ error: `Impossible : ${nbCampeurs} campeur(s) rattaché(s) à cette semaine. Supprimez-les d'abord.` });
    }
    await prisma.semaine.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Semaine introuvable' });
    console.error('delete semaine error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ---------------------------------------------------------------------------
// Import CSV
// ---------------------------------------------------------------------------

// POST /api/admin/import-csv  (multipart, champ: file)
// Rapport détaillé : créés, doublons, lignes ignorées avec raison
router.post('/import-csv', ...adminOnly, require('../middleware/upload').single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });
    const rows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true });

    let created = 0;
    let doublons = 0;
    const ignorees = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const ligne = i + 2; // 1-based + ligne d'en-tête

      if (!isNonEmptyString(row.prenom_enfant) || !isNonEmptyString(row.nom_enfant)) {
        ignorees.push({ ligne, raison: 'prenom_enfant ou nom_enfant manquant' });
        continue;
      }
      if (!isEmail(row.email_parent)) {
        ignorees.push({ ligne, raison: `email_parent invalide (« ${row.email_parent || ''} »)` });
        continue;
      }

      const semaine = await prisma.semaine.findFirst({ where: { nom: row.semaine } });
      if (!semaine) {
        ignorees.push({ ligne, raison: `semaine « ${row.semaine || ''} » introuvable` });
        continue;
      }

      let campeur = await prisma.campeur.findFirst({
        where: { prenom: row.prenom_enfant, nom: row.nom_enfant, semaineId: semaine.id },
      });
      if (!campeur) {
        campeur = await prisma.campeur.create({
          data: { prenom: row.prenom_enfant, nom: row.nom_enfant, semaineId: semaine.id },
        });
      }

      const exists = await prisma.parent.findFirst({
        where: { email: row.email_parent, campeurId: campeur.id },
      });
      if (exists) {
        doublons++;
        continue;
      }

      const parent = await prisma.parent.create({
        data: {
          email: row.email_parent,
          prenom: row.prenom_parent || '',
          nom: row.nom_enfant,
          campeurId: campeur.id,
        },
      });
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const link = await prisma.magicLink.create({ data: { parentId: parent.id, expiresAt } });
      await sendMagicLink(parent.email, link.token).catch(() => {});
      created++;
    }

    res.json({ total: rows.length, created, doublons, ignorees });
  } catch (err) {
    console.error('import-csv error:', err);
    res.status(500).json({ error: 'Erreur serveur — vérifiez le format du CSV.' });
  }
});

// ---------------------------------------------------------------------------
// Employés
// ---------------------------------------------------------------------------

// GET /api/admin/employes — sans hash de mot de passe
router.get('/employes', ...adminOnly, async (req, res) => {
  try {
    const employes = await prisma.employe.findMany({
      select: {
        id: true, email: true, prenom: true, nom: true, role: true, createdAt: true,
        _count: { select: { photosUploaded: true, photosApproved: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(employes);
  } catch (err) {
    console.error('employes GET error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/employes  { email, prenom, nom, role, password }
router.post('/employes', ...adminOnly, async (req, res) => {
  try {
    const { email, prenom, nom, role, password } = req.body;
    if (!isEmail(email)) return res.status(400).json({ error: 'Email invalide.' });
    if (!isNonEmptyString(prenom) || !isNonEmptyString(nom)) return res.status(400).json({ error: 'Prénom et nom requis.' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Rôle invalide.' });
    if (!isNonEmptyString(password) || password.length < 8) return res.status(400).json({ error: 'Mot de passe : 8 caractères minimum.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const employe = await prisma.employe.create({
      data: { email: email.trim().toLowerCase(), prenom: prenom.trim(), nom: nom.trim(), role, passwordHash },
    });
    res.status(201).json({ id: employe.id, email: employe.email, role: employe.role });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Un employé avec cet email existe déjà.' });
    console.error('create employe error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/employes/:id  { prenom?, nom?, role?, password? }
router.put('/employes/:id', ...adminOnly, async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Id invalide' });
    const id = Number(req.params.id);
    const { prenom, nom, role, password } = req.body;

    const data = {};
    if (prenom !== undefined) {
      if (!isNonEmptyString(prenom)) return res.status(400).json({ error: 'Prénom invalide.' });
      data.prenom = prenom.trim();
    }
    if (nom !== undefined) {
      if (!isNonEmptyString(nom)) return res.status(400).json({ error: 'Nom invalide.' });
      data.nom = nom.trim();
    }
    if (role !== undefined) {
      if (!ROLES.includes(role)) return res.status(400).json({ error: 'Rôle invalide.' });
      // Garde-fou : ne pas retirer le dernier ADMIN
      const cible = await prisma.employe.findUnique({ where: { id } });
      if (!cible) return res.status(404).json({ error: 'Employé introuvable' });
      if (cible.role === 'ADMIN' && role !== 'ADMIN') {
        const nbAdmins = await prisma.employe.count({ where: { role: 'ADMIN' } });
        if (nbAdmins <= 1) return res.status(409).json({ error: "Impossible : c'est le dernier compte ADMIN." });
      }
      data.role = role;
    }
    if (password !== undefined) {
      if (!isNonEmptyString(password) || password.length < 8) return res.status(400).json({ error: 'Mot de passe : 8 caractères minimum.' });
      data.passwordHash = await bcrypt.hash(password, 12);
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Aucun champ à mettre à jour.' });

    const employe = await prisma.employe.update({ where: { id }, data });
    res.json({ id: employe.id, email: employe.email, prenom: employe.prenom, nom: employe.nom, role: employe.role });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Employé introuvable' });
    console.error('update employe error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/employes/:id — guards : pas soi-même, pas le dernier admin, pas si photos liées
router.delete('/employes/:id', ...adminOnly, async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Id invalide' });
    const id = Number(req.params.id);

    if (id === req.user.id) return res.status(409).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });

    const cible = await prisma.employe.findUnique({
      where: { id },
      include: { _count: { select: { photosUploaded: true, photosApproved: true } } },
    });
    if (!cible) return res.status(404).json({ error: 'Employé introuvable' });

    if (cible.role === 'ADMIN') {
      const nbAdmins = await prisma.employe.count({ where: { role: 'ADMIN' } });
      if (nbAdmins <= 1) return res.status(409).json({ error: "Impossible : c'est le dernier compte ADMIN." });
    }
    const nbPhotos = cible._count.photosUploaded + cible._count.photosApproved;
    if (nbPhotos > 0) {
      return res.status(409).json({ error: `Impossible : ${nbPhotos} photo(s) liée(s) à ce compte (historique d'upload/approbation).` });
    }

    await prisma.employe.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('delete employe error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ---------------------------------------------------------------------------
// Parents
// ---------------------------------------------------------------------------

// GET /api/admin/parents — liste avec campeur + semaine
router.get('/parents', ...adminOnly, async (req, res) => {
  try {
    const parents = await prisma.parent.findMany({
      include: { campeur: { include: { semaine: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(parents);
  } catch (err) {
    console.error('parents GET error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/parents/:id/resend-link — renvoyer un lien magique
router.post('/parents/:id/resend-link', ...adminOnly, async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Id invalide' });
    const parent = await prisma.parent.findUnique({ where: { id: Number(req.params.id) } });
    if (!parent) return res.status(404).json({ error: 'Parent introuvable' });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const link = await prisma.magicLink.create({ data: { parentId: parent.id, expiresAt } });
    try {
      await sendMagicLink(parent.email, link.token);
    } catch (err) {
      console.error('resend-link SMTP error:', err.message);
      return res.status(502).json({ error: 'Lien créé mais email non envoyé — SMTP non configuré ?' });
    }
    res.json({ ok: true, message: `Lien envoyé à ${parent.email}.` });
  } catch (err) {
    console.error('resend-link error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/parents/:id — cascade manuelle (liens, push, notifications)
router.delete('/parents/:id', ...adminOnly, async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Id invalide' });
    const id = Number(req.params.id);
    const parent = await prisma.parent.findUnique({ where: { id } });
    if (!parent) return res.status(404).json({ error: 'Parent introuvable' });

    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { parentId: id } }),
      prisma.pushSubscription.deleteMany({ where: { parentId: id } }),
      prisma.magicLink.deleteMany({ where: { parentId: id } }),
      prisma.parent.delete({ where: { id } }),
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error('delete parent error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ---------------------------------------------------------------------------
// Campeurs
// ---------------------------------------------------------------------------

// DELETE /api/admin/campeurs/:id — cascade manuelle complète (tags, profils, parents et leurs données)
router.delete('/campeurs/:id', ...adminOnly, async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Id invalide' });
    const id = Number(req.params.id);
    const campeur = await prisma.campeur.findUnique({ where: { id } });
    if (!campeur) return res.status(404).json({ error: 'Campeur introuvable' });

    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { parent: { campeurId: id } } }),
      prisma.pushSubscription.deleteMany({ where: { parent: { campeurId: id } } }),
      prisma.magicLink.deleteMany({ where: { parent: { campeurId: id } } }),
      prisma.parent.deleteMany({ where: { campeurId: id } }),
      prisma.photoTag.deleteMany({ where: { campeurId: id } }),
      prisma.faceProfile.deleteMany({ where: { campeurId: id } }),
      prisma.campeur.delete({ where: { id } }),
    ]);

    // Nettoyage CompreFace (best effort — la DB reste cohérente même si ça échoue)
    if (campeur.compreFaceSubjectId) {
      compreface.supprimerSujet(campeur.compreFaceSubjectId).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('delete campeur error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
