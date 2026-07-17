-- Los roles pasan a ser los tres organos de la federacion:
--   CONSEJO         ve todo, pero no administra (organo de supervision)
--   MESA_DIRECTIVA  lo que hoy hace el ADMIN: invita, modera, gestiona obras
--   FEDERACION      miembro de base
--
-- Nadie pierde acceso: los ADMIN pasan a la mesa directiva y el resto a la
-- federacion. El rol OPERADOR desaparece porque los operadores ya no son
-- cuentas sino fichas del catalogo; las cuentas que lo tuvieran se conservan
-- como miembros de la federacion.

-- Postgres no deja renombrar los valores de un enum en uso: se crea el tipo
-- nuevo, se convierte la columna y se tira el viejo.
ALTER TYPE "Rol" RENAME TO "Rol_anterior";
CREATE TYPE "Rol" AS ENUM ('CONSEJO', 'MESA_DIRECTIVA', 'FEDERACION');

-- El default estorba la conversion: se quita y se repone al final.
ALTER TABLE "usuarios" ALTER COLUMN "rol" DROP DEFAULT;
ALTER TABLE "usuarios" ALTER COLUMN "rol" TYPE "Rol" USING (
  CASE "rol"::text
    WHEN 'ADMIN' THEN 'MESA_DIRECTIVA'
    ELSE 'FEDERACION'
  END
)::"Rol";
ALTER TABLE "usuarios" ALTER COLUMN "rol" SET DEFAULT 'FEDERACION';

DROP TYPE "Rol_anterior";

-- Las invitaciones pendientes guardan el rol como texto en minusculas.
UPDATE "invitaciones" SET "rol" = 'mesa_directiva' WHERE lower("rol") = 'admin';
UPDATE "invitaciones" SET "rol" = 'federacion' WHERE lower("rol") NOT IN ('mesa_directiva', 'consejo');
ALTER TABLE "invitaciones" ALTER COLUMN "rol" SET DEFAULT 'federacion';
