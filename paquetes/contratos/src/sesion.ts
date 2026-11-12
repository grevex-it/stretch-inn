// Login y sesión (ver docs/decisiones/0017): lo que el panel manda y lo que la API responde.
import { z } from "zod";

/** Tope de largo de la clave: scrypt sobre textos enormes sirve para atacar la CPU. */
const LARGO_MAXIMO_DE_CLAVE = 1024;
const LARGO_MINIMO_DE_CLAVE_NUEVA = 10;

const clave = z.string().min(1, "Ingresá la contraseña.").max(LARGO_MAXIMO_DE_CLAVE);

export const pedidoDeIngreso = z.object({
  email: z.string().trim().pipe(z.email("Ingresá un email válido.")),
  clave,
});

export const pedidoDeCentro = z.object({ centroId: z.uuid() });

/** Una sede puntual o «Todas mis sedes». */
export const pedidoDeSede = z.object({ sede: z.union([z.uuid(), z.literal("todas")]) });

export const pedidoDeCambioDeClave = z.object({
  actual: clave,
  nueva: z
    .string()
    .refine(
      (valor) => Array.from(valor).length >= LARGO_MINIMO_DE_CLAVE_NUEVA,
      `La contraseña tiene que tener al menos ${String(LARGO_MINIMO_DE_CLAVE_NUEVA)} caracteres.`,
    )
    .pipe(z.string().max(LARGO_MAXIMO_DE_CLAVE)),
});

const conNombre = z.object({ id: z.uuid(), nombre: z.string() });

/** Respuesta de GET /sesion: quién es y dónde está trabajando. */
export const estadoDeSesion = z.object({
  debeCambiarClave: z.boolean(),
  centros: z.array(conNombre),
  centroActivo: z
    .object({
      id: z.uuid(),
      nombre: z.string(),
      sedeActiva: z.union([z.uuid(), z.literal("todas")]),
      /** Sedes donde tiene algún permiso: con una sola, el selector no aparece. */
      sedes: z.array(conNombre),
      /** Le quitaron los permisos en la sede que tenía y se lo pasó a otra: avisarle. */
      sedeCambiada: z.boolean(),
      /**
       * Permisos en alguna sede del contexto. Solo para mostrar u ocultar en pantalla: la
       * seguridad la aplica la API en cada pedido.
       */
      permisos: z.array(z.string()),
      /** Zona horaria IANA del centro: las fechas viajan en UTC y se muestran en esta zona. */
      zonaHoraria: z.string(),
    })
    .nullable(),
});

export type PedidoDeIngreso = z.infer<typeof pedidoDeIngreso>;
export type PedidoDeCentro = z.infer<typeof pedidoDeCentro>;
export type PedidoDeSede = z.infer<typeof pedidoDeSede>;
export type PedidoDeCambioDeClave = z.infer<typeof pedidoDeCambioDeClave>;
export type EstadoDeSesion = z.infer<typeof estadoDeSesion>;
