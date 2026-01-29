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
    "maxHoursPerWeek" INTEGER NOT NULL,
    "workedHoursPerWeek" INTEGER NOT NULL,
    "workStatus" TEXT NOT NULL
);
INSERT INTO "new_Employee" ("email", "hireDate", "hourlyPay", "id", "maxHoursPerWeek", "name", "phone", "position", "studentId", "supervisor", "workStatus", "workedHoursPerWeek") SELECT "email", "hireDate", "hourlyPay", "id", "maxHoursPerWeek", "name", "phone", "position", "studentId", "supervisor", "workStatus", "workedHoursPerWeek" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_studentId_key" ON "Employee"("studentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
