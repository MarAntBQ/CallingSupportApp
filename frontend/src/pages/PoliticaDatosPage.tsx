import { Link } from 'react-router-dom';
import { RESPONSABLE, RETENCION_MESES } from '../lib/responsable';
import { Footer } from '../components/Footer';

export const PoliticaDatosPage = () => {
  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="text-sm font-medium text-[var(--sage-600)] hover:underline">
          ← Volver al formulario
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-[var(--text)]">
          Política de Protección de Datos Personales
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Viaje para Adorar en el Templo — Los Laureles. Última actualización: agosto de 2026.
        </p>
        <p className="mt-3 text-xs italic text-[var(--text-muted)]">
          Esta no es una página oficial de{' '}
          <a
            href="https://www.churchofjesuschrist.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            La Iglesia de Jesucristo de los Santos de los Últimos Días
          </a>
          . Es una herramienta creada por el Barrio Los Laureles para organizar este viaje, con la autorización del
          obispado y siguiendo las pautas de la{' '}
          <a
            href="https://www.churchofjesuschrist.org/study/manual/general-handbook/38-church-policies-and-guidelines?lang=spa#title_number156"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            sección 38.8.21.2 del Manual General
          </a>
          .
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-[var(--text)]">
          <Seccion titulo="1. Responsable del tratamiento">
            <p>
              <strong>{RESPONSABLE.nombre}</strong>, {RESPONSABLE.profesion}, identificación{' '}
              {RESPONSABLE.identificacion}. Domicilio: {RESPONSABLE.ciudad}. Correo de contacto:{' '}
              <a href={`mailto:${RESPONSABLE.correo}`} className="underline">
                {RESPONSABLE.correo}
              </a>
              . Sitio web: <a href={RESPONSABLE.web} className="underline">{RESPONSABLE.web}</a>.
            </p>
          </Seccion>

          <Seccion titulo="2. Finalidad del tratamiento">
            <p>
              Los datos se recogen para organizar el Viaje para Adorar en el Templo del Barrio Los Laureles: coordinar el número
              de participantes, transporte y las ordenanzas que cada persona desea realizar, y para poder
              contactar a los inscritos con información logística del viaje.
            </p>
          </Seccion>

          <Seccion titulo="3. Base legal">
            <p>
              El tratamiento se basa en el <strong>consentimiento explícito</strong> del titular (art. 7.1 y art. 26
              de la LOPDP), dado que el formulario incluye las ordenanzas que la persona desea realizar — un dato
              relacionado con su creencia religiosa, considerado dato sensible por la ley.
            </p>
          </Seccion>

          <Seccion titulo="4. Datos que se recogen y tipo de tratamiento">
            <p>
              Por cada participante: número de cédula o pasaporte, fecha de nacimiento, nombre completo, teléfono,
              correo electrónico, y las ordenanzas seleccionadas. El tratamiento consiste en el almacenamiento de
              estos datos en una base de datos para su consulta por el responsable, con el único fin descrito en
              el punto 2.
            </p>
          </Seccion>

          <Seccion titulo="5. Tiempo de conservación">
            <p>
              Los datos se conservarán hasta {RETENCION_MESES} meses después de recibida la inscripción, o hasta
              que el viaje al templo correspondiente haya finalizado, lo que ocurra después. Transcurrido ese
              plazo, se eliminan.
            </p>
          </Seccion>

          <Seccion titulo="6. Existencia de la base de datos">
            <p>
              Los datos se almacenan en una base de datos privada del responsable, alojada en su propia
              infraestructura, y no se comparten con terceros salvo lo indicado en el punto 10.
            </p>
          </Seccion>

          <Seccion titulo="7. Origen de los datos">
            <p>Todos los datos son proporcionados directamente por el titular (o por su padre, madre o tutor legal cuando se trate de un menor de edad) al momento de llenar el formulario.</p>
          </Seccion>

          <Seccion titulo="8. Finalidades ulteriores">
            <p>Los datos no se usarán para ninguna finalidad distinta a la descrita en el punto 2.</p>
          </Seccion>

          <Seccion titulo="9. Delegado de Protección de Datos">
            <p>
              No aplica — este tratamiento, por su escala y naturaleza, no requiere la designación de un delegado
              de protección de datos.
            </p>
          </Seccion>

          <Seccion titulo="10. Transferencias de datos">
            <p>
              El formulario está protegido con reCAPTCHA de Google LLC, lo cual implica una transferencia
              internacional de datos técnicos (no de los datos del formulario) a Google, bajo su propia Política de
              Privacidad. No se realizan otras transferencias nacionales ni internacionales.
            </p>
          </Seccion>

          <Seccion titulo="11. Consecuencias de entregar o no los datos">
            <p>
              Si no se proporcionan los datos solicitados, o no se otorga el consentimiento explícito requerido, no
              es posible procesar la inscripción al viaje.
            </p>
          </Seccion>

          <Seccion titulo="12. Efecto de proporcionar datos erróneos">
            <p>
              Datos incorrectos (ej. una fecha de nacimiento o cédula equivocada) pueden impedir la correcta
              coordinación del viaje o de las ordenanzas solicitadas.
            </p>
          </Seccion>

          <Seccion titulo="13. Revocación del consentimiento">
            <p>
              Puedes revocar tu consentimiento en cualquier momento, de forma gratuita y por el mismo medio sencillo
              con el que lo otorgaste, escribiendo a{' '}
              <a href={`mailto:${RESPONSABLE.correo}`} className="underline">
                {RESPONSABLE.correo}
              </a>
              .
            </p>
          </Seccion>

          <Seccion titulo="14. Derechos del titular">
            <p>
              Puedes ejercer tus derechos de acceso, rectificación, actualización, eliminación, oposición,
              anulación y limitación del tratamiento escribiendo a{' '}
              <a href={`mailto:${RESPONSABLE.correo}`} className="underline">
                {RESPONSABLE.correo}
              </a>
              .
            </p>
          </Seccion>

          <Seccion titulo="15. Portabilidad">
            <p>
              Puedes solicitar una copia de tus datos en un formato legible escribiendo al correo anterior.
            </p>
          </Seccion>

          <Seccion titulo="16. Dónde reclamar">
            <p>
              Puedes presentar un reclamo directamente ante el responsable (datos de contacto en el punto 1), o ante
              la Autoridad de Protección de Datos Personales del Ecuador.
            </p>
          </Seccion>

          <Seccion titulo="17. Decisiones automatizadas">
            <p>No se toman decisiones automatizadas ni se realiza perfilado con estos datos.</p>
          </Seccion>
        </div>
      </div>
      <Footer />
    </div>
  );
};

const Seccion = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <section>
    <h2 className="mb-1.5 font-semibold text-[var(--brown-700)]">{titulo}</h2>
    {children}
  </section>
);
