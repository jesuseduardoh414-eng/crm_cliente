-- Los operadores dejan de ser cuentas y pasan a ser fichas que cualquier
-- miembro da de alta, con calificaciones y reportes del resto del equipo.
-- Las noticias del panel pasan a generar tareas, y las reuniones, eventos.
--
-- Los perfiles que ya existian se conservan: se convierten en fichas y las
-- asignaciones de maquinaria se reapuntan a ellas.

-- ── Enums ─────────────────────────────────────────────────────────────────
CREATE TYPE "TipoReporte" AS ENUM ('OBSERVACION', 'REPORTE');
CREATE TYPE "EstadoReporte" AS ENUM ('ABIERTO', 'REVISADO', 'DESCARTADO');
ALTER TYPE "TipoPublicacion" ADD VALUE 'REUNION' BEFORE 'AVISO';

-- ── Ficha de operador ─────────────────────────────────────────────────────
CREATE TABLE "operadores" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "especialidad" TEXT NOT NULL,
    "descripcion" TEXT,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "zona" TEXT,
    "telefono_contacto" TEXT,
    "tarifa_hora" DECIMAL(10,2),
    "experiencia_anios" INTEGER,
    "registrado_por_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operadores_pkey" PRIMARY KEY ("id")
);

-- Columna de paso: guarda de que usuario venia cada ficha para poder reapuntar
-- las asignaciones de maquinaria. Se elimina al final de esta migracion.
ALTER TABLE "operadores" ADD COLUMN "_usuario_origen" INTEGER;

-- Cada perfil existente se convierte en una ficha, a nombre de su propio
-- usuario: era su perfil, es quien responde por el.
INSERT INTO "operadores" (
    "nombre", "especialidad", "descripcion", "disponible", "zona",
    "telefono_contacto", "tarifa_hora", "experiencia_anios",
    "registrado_por_id", "creado_en", "actualizado_en", "_usuario_origen"
)
SELECT
    u."nombre", p."especialidad", p."descripcion", p."disponible", p."zona",
    COALESCE(p."telefono_contacto", u."telefono"), p."tarifa_hora", p."experiencia_anios",
    p."usuario_id", p."creado_en", p."actualizado_en", p."usuario_id"
FROM "perfiles_operador" p
JOIN "usuarios" u ON u."id" = p."usuario_id";

CREATE INDEX "operadores_disponible_idx" ON "operadores"("disponible");
CREATE INDEX "operadores_registrado_por_id_idx" ON "operadores"("registrado_por_id");

ALTER TABLE "operadores" ADD CONSTRAINT "operadores_registrado_por_id_fkey"
    FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Calificaciones ────────────────────────────────────────────────────────
CREATE TABLE "calificaciones_operador" (
    "id" SERIAL NOT NULL,
    "operador_id" INTEGER NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "puntuacion" INTEGER NOT NULL,
    "recomendable" BOOLEAN NOT NULL,
    "comentario" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calificaciones_operador_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "calificaciones_operador_operador_id_idx" ON "calificaciones_operador"("operador_id");
CREATE UNIQUE INDEX "calificaciones_operador_operador_id_autor_id_key" ON "calificaciones_operador"("operador_id", "autor_id");

ALTER TABLE "calificaciones_operador" ADD CONSTRAINT "calificaciones_operador_operador_id_fkey"
    FOREIGN KEY ("operador_id") REFERENCES "operadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "calificaciones_operador" ADD CONSTRAINT "calificaciones_operador_autor_id_fkey"
    FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Reportes y observaciones ──────────────────────────────────────────────
CREATE TABLE "reportes_operador" (
    "id" SERIAL NOT NULL,
    "operador_id" INTEGER NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "tipo" "TipoReporte" NOT NULL DEFAULT 'OBSERVACION',
    "contenido" TEXT NOT NULL,
    "estado" "EstadoReporte" NOT NULL DEFAULT 'ABIERTO',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisado_por_id" INTEGER,
    "revisado_en" TIMESTAMP(3),

    CONSTRAINT "reportes_operador_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reportes_operador_operador_id_tipo_idx" ON "reportes_operador"("operador_id", "tipo");
CREATE INDEX "reportes_operador_estado_idx" ON "reportes_operador"("estado");

ALTER TABLE "reportes_operador" ADD CONSTRAINT "reportes_operador_operador_id_fkey"
    FOREIGN KEY ("operador_id") REFERENCES "operadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reportes_operador" ADD CONSTRAINT "reportes_operador_autor_id_fkey"
    FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reportes_operador" ADD CONSTRAINT "reportes_operador_revisado_por_id_fkey"
    FOREIGN KEY ("revisado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Foto de la ficha ──────────────────────────────────────────────────────
ALTER TABLE "adjuntos" ADD COLUMN "operador_id" INTEGER;
CREATE INDEX "adjuntos_operador_id_idx" ON "adjuntos"("operador_id");
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_operador_id_fkey"
    FOREIGN KEY ("operador_id") REFERENCES "operadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Tareas sin obra, nacidas de una noticia ───────────────────────────────
ALTER TABLE "tareas" ALTER COLUMN "proyectoId" DROP NOT NULL;
ALTER TABLE "tareas" ADD COLUMN "publicacion_id" INTEGER;
CREATE UNIQUE INDEX "tareas_publicacion_id_key" ON "tareas"("publicacion_id");
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_publicacion_id_fkey"
    FOREIGN KEY ("publicacion_id") REFERENCES "publicaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Una tarea del panel no cuelga de ningun proyecto, pero su historial se
-- registra igual.
ALTER TABLE "logs_actividad" ALTER COLUMN "proyectoId" DROP NOT NULL;

-- ── La noticia enlaza a su operador y a su reunion ────────────────────────
ALTER TABLE "publicaciones" ADD COLUMN "operador_id" INTEGER;
ALTER TABLE "publicaciones" ADD COLUMN "evento_id" UUID;
CREATE INDEX "publicaciones_operador_id_idx" ON "publicaciones"("operador_id");
CREATE UNIQUE INDEX "publicaciones_evento_id_key" ON "publicaciones"("evento_id");
ALTER TABLE "publicaciones" ADD CONSTRAINT "publicaciones_operador_id_fkey"
    FOREIGN KEY ("operador_id") REFERENCES "operadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "publicaciones" ADD CONSTRAINT "publicaciones_evento_id_fkey"
    FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── La maquinaria asignada apunta ahora a la ficha, no al usuario ─────────
ALTER TABLE "asignaciones_maquina" DROP CONSTRAINT "asignaciones_maquina_operador_id_fkey";

-- Primero se sueltan las asignaciones cuyo usuario no llego a tener ficha; si
-- no, su id podria colarse como el de una ficha ajena al reapuntar.
UPDATE "asignaciones_maquina" a SET "operador_id" = NULL
WHERE a."operador_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "operadores" o WHERE o."_usuario_origen" = a."operador_id");

UPDATE "asignaciones_maquina" a SET "operador_id" = o."id"
FROM "operadores" o
WHERE o."_usuario_origen" = a."operador_id";

ALTER TABLE "asignaciones_maquina" ADD CONSTRAINT "asignaciones_maquina_operador_id_fkey"
    FOREIGN KEY ("operador_id") REFERENCES "operadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Fin de la conversion ──────────────────────────────────────────────────
ALTER TABLE "operadores" DROP COLUMN "_usuario_origen";
DROP TABLE "perfiles_operador";
