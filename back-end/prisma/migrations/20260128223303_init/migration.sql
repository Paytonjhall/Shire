-- CreateTable
CREATE TABLE "Admin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "level" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "live" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EligibilityRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "minAge" INTEGER NOT NULL,
    "minCreditHours" INTEGER NOT NULL,
    "allowedCountries" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Applicant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "eligibilityKey" TEXT,
    "eligibilityText" TEXT,
    "address" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "birthday" TEXT NOT NULL,
    "citizenshipISO3" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "appliedAt" TEXT NOT NULL,
    "visa" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "decidedAt" TEXT,
    "decidedBy" TEXT,
    "creditHours" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "hourlyPay" REAL NOT NULL,
    "hireDate" TEXT NOT NULL,
    "supervisor" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Applicant_studentId_key" ON "Applicant"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_studentId_key" ON "Employee"("studentId");
