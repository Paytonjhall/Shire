const fs = require("fs/promises");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function readJson(file){
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
}

async function main(){
    const base = path.join(__dirname, ".." );
    const admins = await readJson(path.join(base, "admins.json"));
    const applicants = await readJson(path.join(base, "database.json"));
    const eligibility = await readJson(path.join(base, "eligibilityDB.json"));
    const employees = await readJson(path.join(base, "student-employees.json"));

    await prisma.session.deleteMany();
    await prisma.admin.deleteMany();
    await prisma.applicant.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.eligibilityRule.deleteMany();

    if(Array.isArray(admins.admins)){
        await prisma.admin.createMany({
            data: admins.admins.map(a => ({
                id: a.id,
                name: a.name,
                username: a.username,
                password: a.password,
                level: a.level
            }))
        });
    }

    if(Array.isArray(applicants.students)){
        await prisma.applicant.createMany({
            data: applicants.students.map(s => ({
                id: s.id,
                name: s.name,
                studentId: s.studentId,
                position: s.position,
                eligibilityKey: s.eligibilityKey ?? null,
                eligibilityText: s.eligibilityText ?? null,
                address: s.address,
                age: s.age,
                birthday: s.birthday,
                citizenshipISO3: s.citizenshipISO3,
                email: s.email,
                appliedAt: s.appliedAt,
                visa: s.visa,
                status: s.status,
                decidedAt: s.decidedAt ?? null,
                decidedBy: s.decidedBy ?? null,
                creditHours: s.creditHours
            }))
        });
    }

    if(Array.isArray(employees.employees)){
        await prisma.employee.createMany({
            data: employees.employees.map(e => ({
                id: e.id,
                name: e.name,
                studentId: e.studentId,
                position: e.position,
                hourlyPay: e.hourlyPay,
                hireDate: e.hireDate,
                supervisor: e.supervisor,
                email: e.email,
                phone: e.phone,
                maxHoursPerWeek: e.maxHoursPerWeek,
                workedHoursPerWeek: e.workedHoursPerWeek,
                workStatus: e.workStatus
            }))
        });
    }

    await prisma.eligibilityRule.create({
        data: {
            minAge: eligibility.minAge ?? 18,
            minCreditHours: eligibility.minCreditHours ?? 12,
            allowedCountries: JSON.stringify(eligibility.allowedCountries || [])
        }
    });
}

main()
    .then(() => prisma.$disconnect())
    .catch(async (err) => {
        console.error(err);
        await prisma.$disconnect();
        process.exit(1);
    });
