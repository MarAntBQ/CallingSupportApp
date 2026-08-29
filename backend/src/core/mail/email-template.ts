// Paleta café/sage del proyecto (frontend/src/index.css) — hex literal
// porque el correo lo renderiza el cliente de email, no el navegador, y no
// puede leer custom properties de CSS.
const BROWN_700 = '#8a6a54';
const SAGE_600 = '#7a9269'; // usado en enlaces (BODY_CSS)
const BG = '#faf8f4';
const BORDER = '#e8e2d8';
const TEXT = '#3a332c';
const TEXT_MUTED = '#7d7268';

const BODY_CSS = `
  p{margin:0 0 14px}
  a{color:${SAGE_600};text-decoration:none}
  ul,ol{padding-left:20px;margin:0 0 14px}
  li{margin-bottom:4px}
  h2{font-size:16px;font-weight:700;color:${TEXT};margin:0 0 10px}
  h3{font-size:14px;font-weight:600;color:${TEXT};margin:0 0 8px}
  hr{border:0;border-top:1px solid ${BORDER};margin:18px 0}
`.trim();

// El pie de firma es genérico (nombre de la unidad, tomado de config), no un
// nombre de persona hardcodeado — este proyecto se despliega en distintos
// barrios, cada uno con su propio nombre de unidad.
function buildSignatureRow(unitName: string): string {
  return `<tr>
  <td style="background:${BG};border-top:1px solid ${BORDER};padding:18px 32px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT_MUTED};line-height:1.8">
    <strong style="color:${TEXT}">${unitName}</strong>
  </td>
</tr>`;
}

export function buildBrandedEmailHtml(
  subject: string,
  centerHtml: string,
  unitName: string,
  preheader?: string,
): string {
  const year = new Date().getFullYear();

  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:${BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${subject}</title>
<style>body{margin:0;padding:0;background:${BG}} ${BODY_CSS}</style>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:Arial,Helvetica,sans-serif">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER}">
<tr><td style="background:${BROWN_700};padding:22px 32px">
  <span style="color:#ffffff;font-size:18px;font-weight:700">${unitName}</span>
</td></tr>
<tr><td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${TEXT};line-height:1.6">
${centerHtml}
</td></tr>
${buildSignatureRow(unitName)}
</table>
<p style="font-size:11px;color:${TEXT_MUTED};margin-top:16px">© ${year} ${unitName}</p>
</td></tr>
</table>
</body>
</html>`;
}
