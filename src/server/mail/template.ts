import { EMAIL_COLORS as C } from './email-colors';

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type EmailLabels = { signature: string; footer: string; notOfficial: string };

export function buildBrandedEmail(subject: string, contentHtml: string, unitName: string, preheader: string, labels: EmailLabels) {
  const unit = escapeHtml(unitName);
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Arial,Helvetica,sans-serif;color:${C.text};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:${C.surface};border:1px solid ${C.border};border-radius:10px;">
<tr><td style="padding:20px 24px;background:${C.primary};color:${C.onPrimary};font-size:18px;font-weight:bold;border-radius:10px 10px 0 0;">${unit}</td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.5;color:${C.text};">${contentHtml}</td></tr>
<tr><td style="padding:0 24px 24px;font-size:16px;color:${C.text};">${escapeHtml(labels.signature)}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid ${C.border};font-size:12px;line-height:1.5;color:${C.textMuted};">${escapeHtml(labels.footer)}<br>${escapeHtml(labels.notOfficial)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
