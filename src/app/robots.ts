import type { MetadataRoute } from 'next';

// La aplicación es una herramienta interna de la unidad: no se indexa en ningún ambiente
// (el layout además marca noindex a nivel de metadatos en todas las páginas). El sitio público
// es el de documentación (callingsupportapp.org), que es un proyecto aparte.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
