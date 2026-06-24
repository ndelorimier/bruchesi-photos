const ExcelJS = require('exceljs');

// Normalise un en-tête de colonne : minuscules, sans accents ni caractères non alphanumériques.
// « P1 Email » -> « p1email », « Camper First Name » -> « camperfirstname »
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// Parse un export CampBrain « Camper Applications » → lignes { prenom, nom, parents:[{prenom,email}] }
// (dédup intra-fichier par enfant ; week non incluse, choisie à l'import).
async function parseCamperXlsx(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Fichier vide ou illisible.');

  // Trouver la ligne d'en-tête (celle qui contient Camper First/Last Name)
  let headerRow = -1;
  let colMap = {};
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const keys = {};
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => { keys[norm(cell.text)] = col; });
    if (keys.camperfirstname && keys.camperlastname) { headerRow = r; colMap = keys; break; }
  }
  if (headerRow === -1) {
    throw new Error("En-tête introuvable : le fichier doit contenir les colonnes « Camper First Name » et « Camper Last Name ».");
  }

  const get = (row, key) => {
    const col = colMap[key];
    return col ? String(row.getCell(col).text || '').trim() : '';
  };

  const out = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const prenom = get(row, 'camperfirstname');
    const nom = get(row, 'camperlastname');
    if (!prenom && !nom) continue; // ligne vide

    const parents = [];
    const p1 = get(row, 'p1email').toLowerCase();
    if (isEmail(p1)) parents.push({ prenom: get(row, 'p1firstname') || get(row, 'p1lastname') || '', email: p1 });
    const p2 = get(row, 'p2email').toLowerCase();
    if (isEmail(p2) && p2 !== p1) parents.push({ prenom: get(row, 'p2firstname') || get(row, 'p2lastname') || '', email: p2 });

    out.push({ ligne: r, prenom, nom, parents });
  }
  return out;
}

module.exports = { parseCamperXlsx, isEmail };
