const ExcelJS = require('exceljs');
const { parseCamperXlsx } = require('../src/services/camperImport');

async function buildXlsx(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Camper Applications');
  ws.addRow(['Camper First Name', 'Camper Last Name', 'Season', 'P1FirstName', 'P1 Email', 'P2FirstName', 'P2 Email']);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test('mappe prénom/nom + parent P1', async () => {
  const buf = await buildXlsx([['Théo', 'Tremblay', '2026', 'Marie', 'Marie@X.ca', '', '']]);
  const out = await parseCamperXlsx(buf);
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({ prenom: 'Théo', nom: 'Tremblay' });
  expect(out[0].parents).toEqual([{ prenom: 'Marie', email: 'marie@x.ca' }]); // email normalisé en minuscules
});

test('gère deux parents (P1 + P2)', async () => {
  const buf = await buildXlsx([['Lou', 'Gagnon', '2026', 'Paul', 'paul@x.ca', 'Julie', 'julie@x.ca']]);
  const out = await parseCamperXlsx(buf);
  expect(out[0].parents).toHaveLength(2);
  expect(out[0].parents.map((p) => p.email)).toEqual(['paul@x.ca', 'julie@x.ca']);
});

test('ignore les courriels invalides ou absents', async () => {
  const buf = await buildXlsx([
    ['Sans', 'Mail', '2026', '', '', '', ''],
    ['Bad', 'Email', '2026', 'X', 'pas-un-courriel', '', ''],
  ]);
  const out = await parseCamperXlsx(buf);
  expect(out).toHaveLength(2);
  expect(out[0].parents).toHaveLength(0);
  expect(out[1].parents).toHaveLength(0);
});

test('saute les lignes vides + dédoublonne P1=P2', async () => {
  const buf = await buildXlsx([
    ['', '', '', '', '', '', ''],
    ['Mia', 'Roy', '2026', 'Sam', 'sam@x.ca', 'Sam', 'sam@x.ca'], // même courriel P1/P2
  ]);
  const out = await parseCamperXlsx(buf);
  expect(out).toHaveLength(1);
  expect(out[0].prenom).toBe('Mia');
  expect(out[0].parents).toHaveLength(1); // P2 identique à P1 → non dupliqué
});

test('rejette un fichier sans en-tête attendu', async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Autre');
  ws.addRow(['Nom', 'Courriel']);
  ws.addRow(['Test', 'a@b.ca']);
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  await expect(parseCamperXlsx(buf)).rejects.toThrow(/En-tête introuvable/);
});
