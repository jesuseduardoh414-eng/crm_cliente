-- CreateEnum
CREATE TYPE "EstadoPublicacion" AS ENUM ('BORRADOR', 'PUBLICADA', 'OCULTA');

-- CreateEnum
CREATE TYPE "Visibilidad" AS ENUM ('PUBLICA', 'INTERNA');

-- CreateEnum
CREATE TYPE "TipoPublicacion" AS ENUM ('MAQUINA_RENTA', 'OPERADOR_DISPONIBLE', 'AVISO');

-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'OPERADOR';

-- AlterTable
ALTER TABLE "adjuntos" ADD COLUMN     "maquina_id" INTEGER,
ADD COLUMN     "orden" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "publicacion_id" INTEGER;

-- CreateTable
CREATE TABLE "perfiles_operador" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "especialidad" TEXT NOT NULL,
    "descripcion" TEXT,
    "disponible" BOOLEAN NOT NULL DEFAULT false,
    "zona" TEXT,
    "telefono_contacto" TEXT,
    "tarifa_hora" DECIMAL(10,2),
    "experiencia_anios" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perfiles_operador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maquinas" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "anio" INTEGER,
    "descripcion" TEXT,
    "precio_dia" DECIMAL(10,2),
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "ubicacion" TEXT,
    "propietario_id" INTEGER NOT NULL,
    "estado" "EstadoPublicacion" NOT NULL DEFAULT 'BORRADOR',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maquinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publicaciones" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "cuerpo" TEXT,
    "tipo" "TipoPublicacion" NOT NULL,
    "estado" "EstadoPublicacion" NOT NULL DEFAULT 'PUBLICADA',
    "visibilidad" "Visibilidad" NOT NULL DEFAULT 'PUBLICA',
    "autor_id" INTEGER NOT NULL,
    "maquina_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "perfiles_operador_usuario_id_key" ON "perfiles_operador"("usuario_id");

-- CreateIndex
CREATE INDEX "perfiles_operador_disponible_idx" ON "perfiles_operador"("disponible");

-- CreateIndex
CREATE INDEX "maquinas_propietario_id_idx" ON "maquinas"("propietario_id");

-- CreateIndex
CREATE INDEX "maquinas_disponible_estado_idx" ON "maquinas"("disponible", "estado");

-- CreateIndex
CREATE INDEX "maquinas_tipo_idx" ON "maquinas"("tipo");

-- CreateIndex
CREATE INDEX "publicaciones_estado_visibilidad_creado_en_idx" ON "publicaciones"("estado", "visibilidad", "creado_en");

-- CreateIndex
CREATE INDEX "publicaciones_autor_id_idx" ON "publicaciones"("autor_id");

-- CreateIndex
CREATE INDEX "adjuntos_maquina_id_idx" ON "adjuntos"("maquina_id");

-- CreateIndex
CREATE INDEX "adjuntos_publicacion_id_idx" ON "adjuntos"("publicacion_id");

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_maquina_id_fkey" FOREIGN KEY ("maquina_id") REFERENCES "maquinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_publicacion_id_fkey" FOREIGN KEY ("publicacion_id") REFERENCES "publicaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfiles_operador" ADD CONSTRAINT "perfiles_operador_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maquinas" ADD CONSTRAINT "maquinas_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicaciones" ADD CONSTRAINT "publicaciones_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicaciones" ADD CONSTRAINT "publicaciones_maquina_id_fkey" FOREIGN KEY ("maquina_id") REFERENCES "maquinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
