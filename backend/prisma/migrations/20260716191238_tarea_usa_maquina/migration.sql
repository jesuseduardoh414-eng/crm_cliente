-- AlterTable
ALTER TABLE "tareas" ADD COLUMN     "maquina_id" INTEGER;

-- CreateIndex
CREATE INDEX "tareas_maquina_id_idx" ON "tareas"("maquina_id");

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_maquina_id_fkey" FOREIGN KEY ("maquina_id") REFERENCES "maquinas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

