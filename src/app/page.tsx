import { redirect } from 'next/navigation';

// Mientras el viaje al templo es el único módulo público, la raíz lleva al formulario de
// inscripción (#20). Cuando haya más módulos públicos, esto pasará a ser un portal.
export default function HomePage() {
  redirect('/temple-trip');
}
