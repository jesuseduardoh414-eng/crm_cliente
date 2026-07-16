-- CreateTable
CREATE TABLE "asignaciones_maquina" (
    "id" SERIAL NOT NULL,
    "proyecto_id" INTEGER NOT NULL,
    "maquina_id" INTEGER NOT NULL,
    "operador_id" INTEGER,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),
    "notas" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_id" INTEGER,

    CONSTRAINT "asignaciones_maquina_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asignaciones_maquina_maquina_id_idx" ON "asignaciones_maquina"("maquina_id");

-- CreateIndex
CREATE INDEX "asignaciones_maquina_operador_id_idx" ON "asignaciones_maquina"("operador_id");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_maquina_proyecto_id_maquina_id_key" ON "asignaciones_maquina"("proyecto_id", "maquina_id");

-- AddForeignKey
ALTER TABLE "asignaciones_maquina" ADD CONSTRAINT "asignaciones_maquina_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_maquina" ADD CONSTRAINT "asignaciones_maquina_maquina_id_fkey" FOREIGN KEY ("maquina_id") REFERENCES "maquinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_maquina" ADD CONSTRAINT "asignaciones_maquina_operador_id_fkey" FOREIGN KEY ("operador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_maquina" ADD CONSTRAINT "asignaciones_maquina_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

