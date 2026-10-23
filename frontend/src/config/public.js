export function buildWhatsAppUrl(value, message = 'Hello MERITX, I would like to know more about your subjects and exams.') {
  const number = String(value || '').replace(/\D/g, '');
  if (!/^\d{8,15}$/.test(number)) return '';
  return `https://wa.me/${number}?text=${encodeURIComponent(String(message))}`;
}
