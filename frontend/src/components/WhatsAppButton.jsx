import React from 'react';
import { MessageCircle } from 'lucide-react';
import { buildWhatsAppUrl } from '../config/public';
import './WhatsAppButton.css';

export default function WhatsAppButton() {
  const message = String(import.meta.env.VITE_WHATSAPP_MESSAGE || 'Hello MERITX, I would like to know more about your subjects and exams.');
  const href = buildWhatsAppUrl(import.meta.env.VITE_WHATSAPP_NUMBER, message);
  if (!href) return null;
  return <a className="whatsapp-float" href={href} target="_blank" rel="noreferrer" aria-label="Chat with us on WhatsApp" data-tooltip="Chat with us on WhatsApp"><MessageCircle aria-hidden="true"/></a>;
}
