// Postgres local con los binarios de embedded-postgres, para pnpm db:levantar y los tests.
//
// En Windows, postgres.exe se niega a arrancar si la sesión tiene privilegios de administrador
// (sesión elevada o cuenta Administrator). initdb y pg_ctl, en cambio, se relanzan solos con un
// token restringido. Por eso en Windows el servidor se arranca y se detiene con pg_ctl. En el
// resto de los sistemas se usa embedded-postgres tal cual.
//
// Además, embedded-postgres rechaza start() con undefined si Postgres termina antes de estar
// listo. Acá ese rechazo se convierte en un Error con lo que Postgres escribió.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

type Opciones = NonNullable<ConstructorParameters<typeof EmbeddedPostgres>[0]>;

const EN_WINDOWS = process.platform === "win32";
const LINEAS_GUARDADAS = 50;

/** Ruta de pg_ctl.exe, dentro del paquete de binarios que trae embedded-postgres para Windows. */
function rutaPgCtl(): string {
  const requerir = createRequire(import.meta.resolve("embedded-postgres"));
  const indice = requerir.resolve("@embedded-postgres/windows-x64");
  return join(dirname(indice), "..", "native", "bin", "pg_ctl.exe");
}

interface Corrida {
  codigo: number | null;
  salida: string;
}

function correrPgCtl(argumentos: string[]): Promise<Corrida> {
  return new Promise((resolver, rechazar) => {
    // Mensajes en inglés (como hace embedded-postgres con initdb): traducidos salen en la página
    // de códigos de Windows y no en UTF-8.
    const env = { ...process.env, LC_MESSAGES: "C" };
    const hijo = spawn(rutaPgCtl(), argumentos, { windowsHide: true, env });
    let salida = "";
    hijo.stdout.on("data", (parte: Buffer) => (salida += parte.toString("utf8")));
    hijo.stderr.on("data", (parte: Buffer) => (salida += parte.toString("utf8")));
    hijo.once("error", rechazar);
    // "exit" y no "close": el servidor que lanza pg_ctl puede quedarse con las tuberías abiertas.
    hijo.once("exit", (codigo) => {
      resolver({ codigo, salida: salida.trim() });
    });
  });
}

/** Lo que se agregó al archivo de log desde la posición `desde`. */
function leerLogDesde(archivo: string, desde: number): string {
  if (!existsSync(archivo)) return "";
  return readFileSync(archivo).subarray(desde).toString("utf8").trim();
}

export class PostgresLocal extends EmbeddedPostgres {
  private readonly ultimasLineas: string[];
  private readonly carpeta: string;
  private readonly puerto: number;
  private readonly flags: string[];
  private corriendoConPgCtl = false;
  private deteniendo: Promise<void> | undefined;

  constructor(opciones: Opciones) {
    const ultimasLineas: string[] = [];
    super({
      ...opciones,
      onLog: (mensaje) => {
        ultimasLineas.push(mensaje);
        if (ultimasLineas.length > LINEAS_GUARDADAS) ultimasLineas.shift();
      },
    });
    this.ultimasLineas = ultimasLineas;
    this.carpeta = opciones.databaseDir ?? this.options.databaseDir;
    this.puerto = opciones.port ?? this.options.port;
    this.flags = opciones.postgresFlags ?? [];
  }

  override async start(): Promise<void> {
    if (EN_WINDOWS) {
      await this.arrancarConPgCtl();
      return;
    }
    this.ultimasLineas.length = 0;
    try {
      await super.start();
    } catch (error) {
      const detalle = error instanceof Error ? error.message : this.ultimasLineas.join("").trim();
      throw new Error(`Postgres no arrancó:\n${detalle}`, { cause: error });
    }
  }

  override stop(): Promise<void> {
    if (!EN_WINDOWS) return super.stop();
    // La llaman tanto quien usa la clase como el cierre de embedded-postgres al salir.
    this.deteniendo ??= this.detenerConPgCtl();
    return this.deteniendo;
  }

  override async createDatabase(nombre: string): Promise<void> {
    if (!EN_WINDOWS) {
      await super.createDatabase(nombre);
      return;
    }
    const cliente = this.getPgClient();
    await cliente.connect();
    try {
      await cliente.query(`create database ${cliente.escapeIdentifier(nombre)}`);
    } finally {
      await cliente.end();
    }
  }

  private async arrancarConPgCtl(): Promise<void> {
    const log = join(this.carpeta, "postgres.log");
    const desde = existsSync(log) ? statSync(log).size : 0;
    const opcionesServidor = ["-p", String(this.puerto), ...this.flags].join(" ");
    const corrida = await correrPgCtl([
      "start",
      "-D",
      this.carpeta,
      "-l",
      log,
      "-o",
      opcionesServidor,
      "-w",
      "-t",
      "60",
    ]);
    if (corrida.codigo !== 0) {
      const detalle = [leerLogDesde(log, desde), corrida.salida].filter(Boolean).join("\n");
      throw new Error(`Postgres no arrancó:\n${detalle}`);
    }
    this.corriendoConPgCtl = true;
    this.deteniendo = undefined;
  }

  private async detenerConPgCtl(): Promise<void> {
    if (!this.corriendoConPgCtl) return;
    const corrida = await correrPgCtl(["stop", "-D", this.carpeta, "-m", "fast", "-w"]);
    // Si ya no estaba corriendo (por ejemplo, Ctrl+C también le llegó a Postgres), está bien.
    const estado =
      corrida.codigo === 0 ? corrida : await correrPgCtl(["status", "-D", this.carpeta]);
    if (estado.codigo !== 0 && estado.codigo !== 3) {
      throw new Error(`No se pudo detener Postgres:\n${corrida.salida}`);
    }
    this.corriendoConPgCtl = false;
  }
}
