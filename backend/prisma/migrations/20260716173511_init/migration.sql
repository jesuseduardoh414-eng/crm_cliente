-- CreateEnum
CREATE TYPE "Area" AS ENUM ('DESARROLLO', 'ADMINISTRACION', 'COMUNICACION', 'MARKETING');

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'MIEMBRO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "telefono" TEXT,
    "puesto" TEXT,
    "biografia" TEXT,
    "foto_perfil_url" TEXT,
    "area" "Area" NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'MIEMBRO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetToken" TEXT,
    "resetTokenExpires" TIMESTAMP(3),
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "verificationTokenExpires" TIMESTAMP(3),
    "estado" TEXT DEFAULT 'pendiente',
    "token_invitacion" TEXT,
    "token_expira_en" TIMESTAMP(3),
    "password_hash" TEXT,
    "google_calendar_email" TEXT,
    "google_access_token" TEXT,
    "google_refresh_token" TEXT,
    "google_token_expires_at" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'miembro',
    "token" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "creado_por" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyectos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadorId" INTEGER NOT NULL,
    "area" TEXT NOT NULL DEFAULT 'DESARROLLO',
    "fechaFin" TIMESTAMP(3),
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_proyecto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "area" TEXT NOT NULL DEFAULT 'DESARROLLO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadorId" INTEGER NOT NULL,
    "proyectoBaseId" INTEGER,

    CONSTRAINT "plantillas_proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantillas_tarea" (
    "id" SERIAL NOT NULL,
    "plantillaId" INTEGER NOT NULL,
    "clave" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "prioridad" TEXT NOT NULL DEFAULT 'MEDIA',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "offsetInicioDias" INTEGER NOT NULL DEFAULT 0,
    "offsetVenceDias" INTEGER,
    "dependeDeClave" TEXT,

    CONSTRAINT "plantillas_tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "numeroActividad" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" TEXT NOT NULL DEFAULT 'MEDIA',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completadoEn" TIMESTAMP(3),
    "venceEn" TIMESTAMP(3),
    "proyectoId" INTEGER NOT NULL,
    "asignadoId" INTEGER,
    "creadorId" INTEGER,
    "dependeDeId" INTEGER,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" SERIAL NOT NULL,
    "mensaje" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "tareaId" INTEGER,
    "proyectoId" INTEGER,
    "eventoId" UUID,
    "actorNombre" TEXT,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comentarios" (
    "id" SERIAL NOT NULL,
    "contenido" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autorId" INTEGER NOT NULL,
    "tareaId" INTEGER,
    "proyectoId" INTEGER,

    CONSTRAINT "comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_actividad" (
    "id" SERIAL NOT NULL,
    "accion" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "proyectoId" INTEGER NOT NULL,
    "tareaId" INTEGER,

    CONSTRAINT "logs_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjuntos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" TEXT,
    "tamano" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "tareaId" INTEGER,
    "proyectoId" INTEGER,
    "eventoId" UUID,

    CONSTRAINT "adjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuarioId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL,
    "modalidad" TEXT NOT NULL DEFAULT 'presencial',
    "ubicacion" TEXT,
    "url_reunion" TEXT,
    "instrucciones_acceso" TEXT,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3),
    "todo_el_dia" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT '#4a90d9',
    "alerta_minutos" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "es_compartido" BOOLEAN NOT NULL DEFAULT false,
    "es_global" BOOLEAN NOT NULL DEFAULT false,
    "proyecto_id" INTEGER,
    "creado_por_id" INTEGER,
    "es_recurrente" BOOLEAN NOT NULL DEFAULT false,
    "patron_recurrencia" TEXT,
    "fecha_fin_recurrencia" TIMESTAMP(3),
    "google_calendar_event_id" TEXT,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_invitados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evento_id" UUID NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "visto" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "evento_invitados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendario_laboral" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" INTEGER NOT NULL,
    "dias_laborales" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "hora_entrada" TEXT NOT NULL DEFAULT '09:00',
    "hora_salida" TEXT NOT NULL DEFAULT '18:00',
    "hora_comida_inicio" TEXT NOT NULL DEFAULT '14:00',
    "hora_comida_fin" TEXT NOT NULL DEFAULT '15:00',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendario_laboral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dias_especiales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "dias_especiales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProyectoMiembro" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_AsignadosMultiplesTarea" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_token_invitacion_key" ON "usuarios"("token_invitacion");

-- CreateIndex
CREATE UNIQUE INDEX "invitaciones_token_key" ON "invitaciones"("token");

-- CreateIndex
CREATE UNIQUE INDEX "plantillas_tarea_plantillaId_clave_key" ON "plantillas_tarea"("plantillaId", "clave");

-- CreateIndex
CREATE INDEX "tareas_asignadoId_idx" ON "tareas"("asignadoId");

-- CreateIndex
CREATE INDEX "tareas_creadorId_idx" ON "tareas"("creadorId");

-- CreateIndex
CREATE INDEX "tareas_estado_idx" ON "tareas"("estado");

-- CreateIndex
CREATE INDEX "tareas_proyectoId_numeroActividad_idx" ON "tareas"("proyectoId", "numeroActividad");

-- CreateIndex
CREATE UNIQUE INDEX "evento_invitados_evento_id_usuario_id_key" ON "evento_invitados"("evento_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendario_laboral_usuario_id_key" ON "calendario_laboral"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "dias_especiales_usuario_id_fecha_key" ON "dias_especiales"("usuario_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "_ProyectoMiembro_AB_unique" ON "_ProyectoMiembro"("A", "B");

-- CreateIndex
CREATE INDEX "_ProyectoMiembro_B_index" ON "_ProyectoMiembro"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_AsignadosMultiplesTarea_AB_unique" ON "_AsignadosMultiplesTarea"("A", "B");

-- CreateIndex
CREATE INDEX "_AsignadosMultiplesTarea_B_index" ON "_AsignadosMultiplesTarea"("B");

-- AddForeignKey
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_creadorId_fkey" FOREIGN KEY ("creadorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_proyecto" ADD CONSTRAINT "plantillas_proyecto_creadorId_fkey" FOREIGN KEY ("creadorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_proyecto" ADD CONSTRAINT "plantillas_proyecto_proyectoBaseId_fkey" FOREIGN KEY ("proyectoBaseId") REFERENCES "proyectos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantillas_tarea" ADD CONSTRAINT "plantillas_tarea_plantillaId_fkey" FOREIGN KEY ("plantillaId") REFERENCES "plantillas_proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_asignadoId_fkey" FOREIGN KEY ("asignadoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_creadorId_fkey" FOREIGN KEY ("creadorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_dependeDeId_fkey" FOREIGN KEY ("dependeDeId") REFERENCES "tareas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_actividad" ADD CONSTRAINT "logs_actividad_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_actividad" ADD CONSTRAINT "logs_actividad_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_actividad" ADD CONSTRAINT "logs_actividad_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_tareaId_fkey" FOREIGN KEY ("tareaId") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_invitados" ADD CONSTRAINT "evento_invitados_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_invitados" ADD CONSTRAINT "evento_invitados_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendario_laboral" ADD CONSTRAINT "calendario_laboral_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dias_especiales" ADD CONSTRAINT "dias_especiales_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProyectoMiembro" ADD CONSTRAINT "_ProyectoMiembro_A_fkey" FOREIGN KEY ("A") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProyectoMiembro" ADD CONSTRAINT "_ProyectoMiembro_B_fkey" FOREIGN KEY ("B") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AsignadosMultiplesTarea" ADD CONSTRAINT "_AsignadosMultiplesTarea_A_fkey" FOREIGN KEY ("A") REFERENCES "tareas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AsignadosMultiplesTarea" ADD CONSTRAINT "_AsignadosMultiplesTarea_B_fkey" FOREIGN KEY ("B") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
