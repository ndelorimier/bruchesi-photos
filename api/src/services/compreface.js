const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const BASE = () => process.env.COMPREFACE_URL;
const KEY = () => process.env.COMPREFACE_API_KEY;

async function creerSujet(nom) {
  const res = await axios.post(
    `${BASE()}/api/v1/recognition/subjects`,
    { subject: nom },
    { headers: { 'x-api-key': KEY() } }
  );
  return res.data.subject;
}

async function ajouterImage(subject, imagePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(imagePath));
  const res = await axios.post(
    `${BASE()}/api/v1/recognition/faces?subject=${encodeURIComponent(subject)}`,
    form,
    { headers: { ...form.getHeaders(), 'x-api-key': KEY() } }
  );
  return res.data;
}

async function reconnaitre(imagePath, { limit = 5, detProbThreshold = 0.8 } = {}) {
  const form = new FormData();
  form.append('file', fs.createReadStream(imagePath));
  const res = await axios.post(
    `${BASE()}/api/v1/recognition/recognize?limit=${limit}&det_prob_threshold=${detProbThreshold}`,
    form,
    { headers: { ...form.getHeaders(), 'x-api-key': KEY() } }
  );
  // Retourne tableau de { box, subjects: [{ subject, similarity }] }
  return res.data.result || [];
}

module.exports = { creerSujet, ajouterImage, reconnaitre };
