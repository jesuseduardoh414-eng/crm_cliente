-- AlterEnum
BEGIN;
CREATE TYPE "Area_new" AS ENUM ('VENTAS', 'ALMACEN', 'COMPRAS', 'ADMINISTRACION', 'RENTA', 'TALLER');
ALTER TABLE "usuarios" ALTER COLUMN "area" TYPE "Area_new" USING ("area"::text::"Area_new");
ALTER TYPE "Area" RENAME TO "Area_old";
ALTER TYPE "Area_new" RENAME TO "Area";
DROP TYPE "Area_old";
COMMIT;

-- AlterTable
ALTER TABLE "plantillas_proyecto" ALTER COLUMN "area" SET DEFAULT 'VENTAS';

-- AlterTable
ALTER TABLE "proyectos" ALTER COLUMN "area" SET DEFAULT 'VENTAS';

