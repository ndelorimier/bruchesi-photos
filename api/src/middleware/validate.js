// Prédicats de validation réutilisables — les routes renvoient des 400 clairs
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isValidDate = (v) => Boolean(v) && !Number.isNaN(new Date(v).getTime());
const isId = (v) => Number.isInteger(Number(v)) && Number(v) > 0;

module.exports = { isNonEmptyString, isEmail, isValidDate, isId };
