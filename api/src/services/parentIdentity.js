// L'identité d'un parent est portée par son COURRIEL : un même courriel peut
// correspondre à plusieurs lignes Parent (une par enfant). Ces helpers résolvent
// le parent connecté vers l'ensemble de ses lignes.
//
// Rétrocompatibilité : les jetons émis avant le passage à l'identité-par-courriel
// portent { id } et non { email }. On retombe sur l'id tant que ces jetons
// (durée de vie 24 h) n'ont pas expiré, pour ne déconnecter personne.

// Clause Prisma `where` ciblant toutes les lignes Parent du parent connecté.
function whereForUser(user) {
  if (user?.email) return { email: user.email };
  if (user?.id != null) return { id: user.id };
  // Ni email ni id : ne matcher AUCUNE ligne (jamais `where: {}` qui renverrait tout).
  return { id: -1 };
}

// Le parent connecté possède-t-il au moins une des lignes Parent fournies ?
function ownsAny(user, parents) {
  if (user?.email) return parents.some((p) => p.email === user.email);
  if (user?.id != null) return parents.some((p) => p.id === user.id);
  return false;
}

module.exports = { whereForUser, ownsAny };
