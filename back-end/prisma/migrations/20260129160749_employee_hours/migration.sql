/*
  Warnings:

  - Added the required column `maxHoursPerWeek` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workStatus` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workedHoursPerWeek` to the `Employee` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "hourlyPay" REAL NOT NULL,
    "hireDate" TEXT NOT NULL,
    "supervisor" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "maxHoursPerWeek" INTEGER NOT NULL DEFAULT 20,
    "workedHoursPerWeek" INTEGER NOT NULL DEFAULT 0,
    "workStatus" TEXT NOT NULL DEFAULT 'No issues'
);
INSERT INTO "new_Employee" ("email", "hireDate", "hourlyPay", "id", "name", "phone", "position", "studentId", "supervisor") SELECT "email", "hireDate", "hourlyPay", "id", "name", "phone", "position", "studentId", "supervisor" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_studentId_key" ON "Employee"("studentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
