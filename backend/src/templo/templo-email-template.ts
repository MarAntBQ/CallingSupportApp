const BROWN_DARK = '#5c4737';
const SAGE = '#7a9269';
const CREAM = '#faf8f4';
const GRAY = '#7d7268';

interface ParticipanteEmail {
  nombreCompleto: string;
  cedulaOPasaporte: string;
  fechaNacimiento: string;
  telefono: string;
  email: string;
  genero: string;
  vaEnTransporte: boolean;
  necesitaHospedaje: boolean;
  quiereDesayuno: boolean;
  quiereAlmuerzo: boolean;
  ordenanzas: string[];
}

function participanteCardHtml(p: ParticipanteEmail): string {
  const ordenanzas = p.ordenanzas.length ? p.ordenanzas.join(', ') : 'Sin ordenanzas (menor de edad)';
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;border:1px solid #e8e2d8;border-radius:8px;overflow:hidden">
    <tr>
      <td style="background:${CREAM};padding:16px 20px">
        <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:${BROWN_DARK}">${p.nombreCompleto} <span style="font-weight:400;color:${GRAY}">(${p.genero})</span></p>
        <p style="margin:0 0 3px;font-size:13px;color:#3a332c">📄 ${p.cedulaOPasaporte} &nbsp;·&nbsp; 🎂 ${p.fechaNacimiento}</p>
        <p style="margin:0 0 3px;font-size:13px;color:#3a332c">📞 ${p.telefono} &nbsp;·&nbsp; ✉️ ${p.email}</p>
        <p style="margin:0 0 3px;font-size:13px;color:#3a332c">🚌 ${p.vaEnTransporte ? 'Sí' : 'No'} va en transporte del barrio &nbsp;·&nbsp; 🛏 ${p.necesitaHospedaje ? 'Sí' : 'No'} necesita hospedaje</p>
        <p style="margin:0 0 3px;font-size:13px;color:#3a332c">🍳 ${p.quiereDesayuno ? 'Sí' : 'No'} quiere desayuno &nbsp;·&nbsp; 🍽 ${p.quiereAlmuerzo ? 'Sí' : 'No'} quiere almuerzo</p>
        <p style="margin:0;font-size:13px;color:${SAGE};font-weight:600">⛪ ${ordenanzas}</p>
      </td>
    </tr>
  </table>`;
}

// nombreUnidad viene de config (Obispado/SuperAdmin lo define en su propio
// despliegue) — este correo no lleva logo embebido a propósito, porque el
// logo es específico de cada barrio, no algo genérico del proyecto open source.
export function buildInscripcionEmailHtml(participantes: ParticipanteEmail[], nombreUnidad: string): string {
  const cards = participantes.map(participanteCardHtml).join('');
  const year = new Date().getFullYear();
  const unidad = nombreUnidad || 'tu unidad';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nueva inscripción — Viaje para Adorar en el Templo</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:32px 16px">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

      <tr>
        <td style="background:${BROWN_DARK};border-radius:10px 10px 0 0;padding:20px 28px" align="center">
          <span style="color:#ffffff;font-size:17px;font-weight:bold">Viaje para Adorar en el Templo — ${unidad}</span>
        </td>
      </tr>
      <tr><td style="background:${SAGE};height:3px"></td></tr>

      <tr>
        <td style="background:#ffffff;padding:28px;border-left:1px solid #e8e2d8;border-right:1px solid #e8e2d8">
          <p style="margin:0 0 18px;font-size:14px;color:#3a332c">Se recibió una nueva inscripción para el Viaje para Adorar en el Templo:</p>
          ${cards}
        </td>
      </tr>

      <tr>
        <td style="background:${CREAM};border-top:1px solid #e8e2d8;padding:16px 28px;text-align:center;font-size:12px;color:${GRAY};line-height:1.7">
          Notificación automática — no es necesario responder este correo.
        </td>
      </tr>

      <tr>
        <td style="background:${BROWN_DARK};border-radius:0 0 10px 10px;padding:12px 28px;text-align:center;font-size:11px;color:#d9cfc2">
          &copy; ${year} ${unidad}
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}
