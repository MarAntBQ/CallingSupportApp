const NAVY_DARK = '#0a1226';
const AMBER = '#fca311';
const AMBER_LINK = '#b45f06';
const GRAY = '#6b7785';

const BODY_CSS = `
  p{margin:0 0 14px}
  a{color:${AMBER_LINK};text-decoration:none}
  ul,ol{padding-left:20px;margin:0 0 14px}
  li{margin-bottom:4px}
  h2{font-size:16px;font-weight:700;color:${NAVY_DARK};margin:0 0 10px}
  h3{font-size:14px;font-weight:600;color:${NAVY_DARK};margin:0 0 8px}
  hr{border:0;border-top:1px solid #dde5ee;margin:18px 0}
`.trim();

// El pie de firma es genérico (nombre de la unidad, tomado de config), no un
// nombre de persona hardcodeado — este proyecto se despliega en distintos
// barrios, cada uno con su propio nombre de unidad.
function buildSignatureRow(unitName: string): string {
  return `<tr>
  <td style="background:#f4f7fb;border-top:1px solid #dde5ee;padding:18px 32px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${GRAY};line-height:1.8">
    <strong style="color:${NAVY_DARK}">${unitName}</strong>
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
    ? `<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${subject}</title>
<style>body{margin:0;padding:0;background:#f0f4f8} ${BODY_CSS}</style>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dde5ee">
<tr><td style="background:${NAVY_DARK};padding:22px 32px">
  <span style="color:#ffffff;font-size:18px;font-weight:700">${unitName}</span>
  <span style="color:${AMBER};font-size:12px;margin-left:6px">Notificaciones</span>
</td></tr>
<tr><td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${NAVY_DARK};line-height:1.6">
${centerHtml}
</td></tr>
${buildSignatureRow(unitName)}
</table>
<p style="font-size:11px;color:#9aa7b5;margin-top:16px">© ${year} ${unitName}</p>
</td></tr>
</table>
</body>
</html>`;
}
