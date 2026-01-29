const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const app = express();
const PORT = process.env.PORT || 3001;
const SESSION_TTL_MS = 10 * 60 * 1000;

const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

async function getEligibilityRule(){
    const rule = await prisma.eligibilityRule.findFirst();
    if(!rule){
        return { minAge: 18, minCreditHours: 12, allowedCountries: [] };
    }
    let allowedCountries = [];
    try{
        allowedCountries = JSON.parse(rule.allowedCountries || "[]");
    } catch {
        allowedCountries = [];
    }
    return {
        minAge: rule.minAge,
        minCreditHours: rule.minCreditHours,
        allowedCountries
    };
}

function computeEligibility(student, rules){
    const ageOk = Number(student.age) >= Number(rules.minAge);
    const citizenOk = rules.allowedCountries.includes(String(student.citizenshipISO3 || "").toUpperCase());
    const visaOk = String(student.visa || "").toLowerCase() === "no issues";
    const creditOk = Number(student.creditHours) >= Number(rules.minCreditHours);
    const trueCount = [ageOk, citizenOk, visaOk, creditOk].filter(Boolean).length;

    if(trueCount === 4){
        return { eligibilityKey: "eligible", eligibilityText: "Eligible" };
    }
    if(trueCount === 0){
        return { eligibilityKey: "ineligible", eligibilityText: "Ineligible" };
    }
    return { eligibilityKey: "actions", eligibilityText: "Actions Needed" };
}

function withEligibility(students, rules){
    return students.map(s => ({ ...s, ...computeEligibility(s, rules) }));
}

function computeWorkStatus(employee){
    const maxHours = Number(employee.maxHoursPerWeek || 0);
    const worked = Number(employee.workedHoursPerWeek || 0);
    return worked > maxHours ? "Needs actions" : "No issues";
}

async function createSession(username){
    const token = crypto.randomUUID();
    const live = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.session.create({ data: { token, username, live } });
    return { token, live: live.toISOString() };
}

async function validateSession(token){
    if(!token) return { error: "Missing session", statusCode: 401 };
    const session = await prisma.session.findUnique({ where: { token } });
    if(!session) return { error: "Invalid session", statusCode: 401 };
    if(session.live.getTime() < Date.now()){
        await prisma.session.delete({ where: { token } });
        return { error: "Session expired", statusCode: 401 };
    }
    return { session };
}

async function requireSession(req, res, allowedLevels){
    try{
        const token = req.header("x-session-token") || req.body?.token || "";
        const { session, error, statusCode } = await validateSession(token);
        if(error) return res.status(statusCode).json({ error });

        const admin = await prisma.admin.findUnique({
            where: { username: session.username }
        });
        if(!admin) return res.status(401).json({ error: "Unknown admin" });

        if(allowedLevels && !allowedLevels.includes(admin.level)){
            return res.status(403).json({ error: "Forbidden" });
        }

        req.admin = admin;
        req.session = session;
        return null;
    } catch (err){
        return res.status(500).json({ error: "Session validation failed" });
    }
}

app.get("/getAllStudents", async (req, res) => {
    try{
        const auth = await requireSession(req, res, ["superadmin", "admin", "readonly"]);
        if(auth) return;
        const [students, rules] = await Promise.all([
            prisma.applicant.findMany(),
            getEligibilityRule()
        ]);
        res.json(withEligibility(students, rules));
    } catch (err){
        res.status(500).json({ error: "Failed to read database" });
    }
});

app.get("/getAllAcceptedStudents", async (req, res) => {
    try{
        const auth = await requireSession(req, res, ["superadmin", "admin", "readonly"]);
        if(auth) return;
        const [students, rules] = await Promise.all([
            prisma.applicant.findMany({ where: { status: "accepted" } }),
            getEligibilityRule()
        ]);
        res.json(withEligibility(students, rules));
    } catch (err){
        res.status(500).json({ error: "Failed to read database" });
    }
});

app.get("/getAllDeniedStudents", async (req, res) => {
    try{
        const auth = await requireSession(req, res, ["superadmin", "admin", "readonly"]);
        if(auth) return;
        const [students, rules] = await Promise.all([
            prisma.applicant.findMany({ where: { status: "denied" } }),
            getEligibilityRule()
        ]);
        res.json(withEligibility(students, rules));
    } catch (err){
        res.status(500).json({ error: "Failed to read database" });
    }
});

app.get("/getAllUndecidedStudents", async (req, res) => {
    try{
        const auth = await requireSession(req, res, ["superadmin", "admin", "readonly"]);
        if(auth) return;
        const [students, rules] = await Promise.all([
            prisma.applicant.findMany({ where: { status: "undecided" } }),
            getEligibilityRule()
        ]);
        res.json(withEligibility(students, rules));
    } catch (err){
        res.status(500).json({ error: "Failed to read database" });
    }
});

app.get("/getEligibilityRequirements", async (req, res) => {
    try{
        const auth = await requireSession(req, res, ["superadmin", "admin", "readonly"]);
        if(auth) return;
        const rules = await getEligibilityRule();
        res.json(rules);
    } catch (err){
        res.status(500).json({ error: "Failed to read eligibility requirements" });
    }
});

app.get("/getApplicantCounts", async (req, res) => {
    try{
        const auth = await requireSession(req, res, ["superadmin", "admin", "readonly"]);
        if(auth) return;
        const [students, rules] = await Promise.all([
            prisma.applicant.findMany({ where: { status: "undecided" } }),
            getEligibilityRule()
        ]);
        const withElig = withEligibility(students, rules);
        const counts = { eligible: 0, actions: 0, ineligible: 0 };
        for(const s of withElig){
            if(s.eligibilityKey === "eligible") counts.eligible += 1;
            else if(s.eligibilityKey === "actions") counts.actions += 1;
            else if(s.eligibilityKey === "ineligible") counts.ineligible += 1;
        }
        res.json(counts);
    } catch (err){
        res.status(500).json({ error: "Failed to read applicant counts" });
    }
});

app.get("/getStudentEmployees", async (req, res) => {
    try{
        const auth = await requireSession(req, res, ["superadmin", "admin", "readonly"]);
        if(auth) return;
        const employees = await prisma.employee.findMany();
        res.json(employees.map(e => ({ ...e, workStatus: computeWorkStatus(e) })));
    } catch (err){
        res.status(500).json({ error: "Failed to read student employees" });
    }
});

app.put("/increasePay", async (req, res) => {
    try{
        const auth = await requireSession(req, res, ["superadmin", "admin"]);
        if(auth) return;
        const { studentId, amount } = req.body || {};
        if(!studentId) return res.status(400).json({ error: "Missing studentId" });
        const bump = Number.isFinite(Number(amount)) ? Number(amount) : 1;

        const employee = await prisma.employee.findUnique({ where: { studentId } });
        if(!employee) return res.status(404).json({ error: "Student not found" });

        const updated = await prisma.employee.update({
            where: { studentId },
            data: { hourlyPay: Number((Number(employee.hourlyPay || 0) + bump).toFixed(2)) }
        });
        res.json({ ...updated, workStatus: computeWorkStatus(updated) });
    } catch (err){
        res.status(500).json({ error: "Failed to increase pay" });
    }
});

app.delete("/fireStudent", async (req, res) => {
    try{
        const auth = await requireSession(req, res, ["superadmin", "admin"]);
        if(auth) return;
        const { studentId } = req.body || {};
        if(!studentId) return res.status(400).json({ error: "Missing studentId" });

        const employee = await prisma.employee.findUnique({ where: { studentId } });
        if(!employee) return res.status(404).json({ error: "Student not found" });

        await prisma.employee.delete({ where: { studentId } });
        res.json(employee);
    } catch (err){
        res.status(500).json({ error: "Failed to fire student" });
    }
});

app.put("/modifyEligibilityRequirements", async (req, res) => {
    try{
        const auth = await requireSession(req, res, ["superadmin"]);
        if(auth) return;
        const { minAge, minCreditHours, allowedCountries } = req.body || {};
        const parsedMinAge = Number(minAge);
        if(!Number.isFinite(parsedMinAge) || parsedMinAge < 0){
            return res.status(400).json({ error: "Invalid minAge" });
        }
        const parsedMinCreditHours = Number(minCreditHours);
        if(!Number.isFinite(parsedMinCreditHours) || parsedMinCreditHours < 0){
            return res.status(400).json({ error: "Invalid minCreditHours" });
        }
        if(!Array.isArray(allowedCountries)){
            return res.status(400).json({ error: "Invalid allowedCountries" });
        }
        const cleanedCountries = allowedCountries
            .map(c => String(c).toUpperCase().trim())
            .filter(Boolean);

        const existing = await prisma.eligibilityRule.findFirst();
        const data = {
            minAge: parsedMinAge,
            minCreditHours: parsedMinCreditHours,
            allowedCountries: JSON.stringify(cleanedCountries)
        };
        const updated = existing
            ? await prisma.eligibilityRule.update({ where: { id: existing.id }, data })
            : await prisma.eligibilityRule.create({ data });

        res.json({
            minAge: updated.minAge,
            minCreditHours: updated.minCreditHours,
            allowedCountries: cleanedCountries
        });
    } catch (err){
        res.status(500).json({ error: "Failed to update eligibility requirements" });
    }
});

app.put("/login", async (req, res) => {
    try{
        const { username, password } = req.body || {};
        if(!username || !password){
            return res.status(400).json({ error: "Missing credentials" });
        }

        const match = await prisma.admin.findFirst({
            where: {
                OR: [
                    { username: String(username) },
                    { name: String(username) }
                ],
                password: String(password)
            }
        });

        if(!match) return res.status(401).json({ error: "Invalid credentials" });
        const session = await createSession(match.username);
        res.json({
            name: match.name,
            level: match.level,
            id: match.id,
            token: session.token,
            live: session.live,
            username: match.username
        });
    } catch (err){
        res.status(500).json({ error: "Failed to login" });
    }
});

app.put("/addAdmin", async (req, res) => {
    try{
        const auth = await requireSession(req, res, ["superadmin"]);
        if(auth) return;
        const { name, username, password, level } = req.body || {};
        if(!name || !username || !password || !level){
            return res.status(400).json({ error: "Missing fields" });
        }

        const exists = await prisma.admin.findUnique({ where: { username } });
        if(exists) return res.status(409).json({ error: "Username already exists" });

        const newAdmin = await prisma.admin.create({
            data: { name, username, password, level }
        });

        res.json({ id: newAdmin.id, name: newAdmin.name, username: newAdmin.username, level: newAdmin.level });
    } catch (err){
        res.status(500).json({ error: "Failed to add admin" });
    }
});

app.delete("/removeAdmin", async (req, res) => {
    try{
        const auth = await requireSession(req, res, ["superadmin"]);
        if(auth) return;
        const { id } = req.body || {};
        const numericId = Number(id);
        if(!Number.isFinite(numericId)){
            return res.status(400).json({ error: "Missing id" });
        }

        const admin = await prisma.admin.findUnique({ where: { id: numericId } });
        if(!admin) return res.status(404).json({ error: "Admin not found" });

        await prisma.admin.delete({ where: { id: numericId } });
        res.json({ id: admin.id, name: admin.name, username: admin.username, level: admin.level });
    } catch (err){
        res.status(500).json({ error: "Failed to remove admin" });
    }
});

app.put("/acceptStudent", async (req, res) => {
    try{
        const auth = await requireSession(req, res, ["superadmin", "admin"]);
        if(auth) return;
        const { id, decidedBy } = req.body || {};
        if(!id) return res.status(400).json({ error: "Missing id" });
        if(!decidedBy) return res.status(400).json({ error: "Missing decidedBy" });

        const updated = await prisma.applicant.update({
            where: { id },
            data: {
                status: "accepted",
                decidedAt: new Date().toISOString(),
                decidedBy
            }
        });

        const rules = await getEligibilityRule();
        res.json({ ...updated, ...computeEligibility(updated, rules) });
    } catch (err){
        res.status(500).json({ error: "Failed to update student" });
    }
});

app.put("/denyStudent", async (req, res) => {
    try{
        const auth = await requireSession(req, res, ["superadmin", "admin"]);
        if(auth) return;
        const { id, decidedBy } = req.body || {};
        if(!id) return res.status(400).json({ error: "Missing id" });
        if(!decidedBy) return res.status(400).json({ error: "Missing decidedBy" });

        const updated = await prisma.applicant.update({
            where: { id },
            data: {
                status: "denied",
                decidedAt: new Date().toISOString(),
                decidedBy
            }
        });

        const rules = await getEligibilityRule();
        res.json({ ...updated, ...computeEligibility(updated, rules) });
    } catch (err){
        res.status(500).json({ error: "Failed to update student" });
    }
});

app.put("/reopenStudent", async (req, res) => {
    try{
        const auth = await requireSession(req, res, ["superadmin", "admin"]);
        if(auth) return;
        const { id } = req.body || {};
        if(!id) return res.status(400).json({ error: "Missing id" });

        const updated = await prisma.applicant.update({
            where: { id },
            data: {
                status: "undecided",
                decidedAt: null,
                decidedBy: null
            }
        });

        const rules = await getEligibilityRule();
        res.json({ ...updated, ...computeEligibility(updated, rules) });
    } catch (err){
        res.status(500).json({ error: "Failed to update student" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
