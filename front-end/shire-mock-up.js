// ========= Data =========
const API_BASE = "http://localhost:3001";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const STORAGE_KEY_ADMIN = "shireAdmin";
const STORAGE_KEY_THEME = "shireTheme";

const state = {
    currentView: "applicants",
    currentEligibilityFilter: "all",
    selectedApplicantId: null,
    applicantsPage: 1,
    applicantsPageSize: 10,
    currentAdmin: null,

    applicants: [],

    approved: [],
    denied: [],
    employees: [],
    selectedEmployeeId: null,

    // sort state per table
    sort: {
        applicants: { key: "appliedAt", dir: "desc" },
        approved:   { key: "decidedAt", dir: "desc" },
        denied:     { key: "decidedAt", dir: "desc" }
    }
};

// ========= Helpers =========
function getInitials(fullName){
    const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || "";
    const last = (parts.length > 1 ? parts[parts.length - 1][0] : "") || "";
    return (first + last).toUpperCase();
}

function formatDateTime(iso){
    // Simple consistent display (local time). Customize later if needed.
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso || "—";
    return d.toLocaleString(undefined, {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
    });
}

function eligibilityTdClass(key){
    if(key === "eligible") return "eligibility eligible";
    if(key === "actions") return "eligibility actions";
    return "eligibility ineligible";
}

function badgeClass(key){
    if(key === "eligible") return "badge-eligible";
    if(key === "actions") return "badge-actions";
    return "badge-ineligible";
}

function buttonTextWithCountdown(btn, originalText){
    btn.textContent = "Are you sure?";
    btn.disabled = true;
    setTimeout(() => {
        btn.disabled = false;
    }, 1000);
}

function compareValues(a, b){
    // null-safe, string/number/date-aware
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;

    // If ISO date-ish, compare as Date
    const aDate = (typeof a === "string" && /^\d{4}-\d{2}-\d{2}T/.test(a)) ? new Date(a) : null;
    const bDate = (typeof b === "string" && /^\d{4}-\d{2}-\d{2}T/.test(b)) ? new Date(b) : null;
    if (aDate && bDate) return aDate - bDate;

    // numeric
    if (typeof a === "number" && typeof b === "number") return a - b;

    // default: case-insensitive string compare
    return String(a).localeCompare(String(b), undefined, { numeric:true, sensitivity:"base" });
}

function handleAuthFailure(){
    localStorage.removeItem(STORAGE_KEY_ADMIN);
    state.currentAdmin = null;
    showLoginScreen();
}

async function apiGet(path){
    const token = state.currentAdmin?.token || "";
    const res = await fetch(`${API_BASE}/${path}`, {
        headers: { "x-session-token": token }
    });
    if(res.status === 401){
        handleAuthFailure();
        throw new Error("Session expired");
    }
    if(!res.ok){
        const text = await res.text();
        throw new Error(`GET ${path} failed: ${res.status} ${text}`);
    }
    return res.json();
}

async function apiPut(path, body){
    const token = state.currentAdmin?.token || "";
    const res = await fetch(`${API_BASE}/${path}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "x-session-token": token
        },
        body: JSON.stringify(body)
    });
    if(res.status === 401){
        handleAuthFailure();
        throw new Error("Session expired");
    }
    if(!res.ok){
        const text = await res.text();
        throw new Error(`PUT ${path} failed: ${res.status} ${text}`);
    }
    return res.json();
}

async function apiDelete(path, body){
    const token = state.currentAdmin?.token || "";
    const res = await fetch(`${API_BASE}/${path}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "x-session-token": token
        },
        body: JSON.stringify(body)
    });
    if(res.status === 401){
        handleAuthFailure();
        throw new Error("Session expired");
    }
    if(!res.ok){
        const text = await res.text();
        throw new Error(`DELETE ${path} failed: ${res.status} ${text}`);
    }
    return res.json();
}

function showToast(message, actionLabel, actionFn){
    const toast = document.getElementById("toast");
    const text = document.getElementById("toastText");
    const action = document.getElementById("toastAction");
    if(!toast || !text || !action) return;

    text.textContent = message;
    action.textContent = actionLabel;
    action.style.display = "inline-flex";
    toast.classList.remove("error");
    action.onclick = () => {
        toast.classList.remove("show");
        if(typeof actionFn === "function") actionFn();
    };
    toast.classList.add("show");
}

function showErrorToast(message){
    const toast = document.getElementById("toast");
    const text = document.getElementById("toastText");
    const action = document.getElementById("toastAction");
    if(!toast || !text || !action) return;

    text.textContent = message;
    action.textContent = "";
    action.style.display = "none";
    action.onclick = null;
    toast.classList.add("error");
    toast.classList.add("show");
}

function canDecide(){
    return state.currentAdmin?.level === "superadmin" || state.currentAdmin?.level === "admin";
}

function setAdmin(admin){
    state.currentAdmin = admin;
    const avatar = document.getElementById("adminAvatar");
    const name = document.getElementById("adminName");
    if(avatar) avatar.textContent = getInitials(admin?.name || "");
    if(name) name.textContent = admin?.name || "—";
}

async function loadEligibilitySettings(){
    const minAgeInput = document.getElementById("minAgeInput");
    const minCreditsInput = document.getElementById("minCreditsInput");
    const countriesInput = document.getElementById("allowedCountriesInput");
    const form = document.getElementById("eligibilityForm");
    if(!minAgeInput || !minCreditsInput || !countriesInput || !form) return;

    const isSuper = state.currentAdmin?.level === "superadmin";
    minAgeInput.disabled = !isSuper;
    minCreditsInput.disabled = !isSuper;
    countriesInput.disabled = !isSuper;
    form.querySelector("button[type=\"submit\"]").disabled = !isSuper;
    form.classList.toggle("disabled", !isSuper);

    try{
        const rules = await apiGet("getEligibilityRequirements");
        minAgeInput.value = Number.isFinite(Number(rules.minAge)) ? String(rules.minAge) : "";
        minCreditsInput.value = Number.isFinite(Number(rules.minCreditHours)) ? String(rules.minCreditHours) : "";
        countriesInput.value = Array.isArray(rules.allowedCountries) ? rules.allowedCountries.join(", ") : "";
    } catch (err){
        console.error("Failed to load eligibility requirements:", err);
        showErrorToast("Unable to get data.");
    }
}

function applyAdminFormPermissions(){
    const form = document.getElementById("adminForm");
    if(!form) return;
    const isSuper = state.currentAdmin?.level === "superadmin";
    form.classList.toggle("disabled", !isSuper);
    form.querySelectorAll("input, select, button").forEach(el => {
        el.disabled = !isSuper;
    });
}

function showLoginScreen(){
    const login = document.getElementById("loginScreen");
    const app = document.getElementById("appShell");
    if(login) login.classList.remove("hidden");
    if(app) app.classList.add("hidden");
}

function showAppShell(){
    const login = document.getElementById("loginScreen");
    const app = document.getElementById("appShell");
    if(login) login.classList.add("hidden");
    if(app) app.classList.remove("hidden");
}

async function loadInitialData(){
    if(!state.currentAdmin?.token){
        showLoginScreen();
        return;
    }
    try{
        let undecided = [];
        try{
            undecided = await apiGet("getAllUndecidedStudents");
            state.applicants = Array.isArray(undecided) ? undecided : [];
        } catch (err){
            console.error("Failed to load undecided students:", err);
            state.applicants = [];
            showToast("Unable to get data.", "try again?", () => {
                loadInitialData().then(renderAll);
            });
        }

        try{
            const accepted = await apiGet("getAllAcceptedStudents");
            state.approved = Array.isArray(accepted) ? accepted : [];
        } catch (err){
            console.error("Failed to load accepted students:", err);
            state.approved = [];
        }

        try{
            const denied = await apiGet("getAllDeniedStudents");
            state.denied = Array.isArray(denied) ? denied : [];
        } catch (err){
            console.error("Failed to load denied students:", err);
            state.denied = [];
        }
    } catch (err){
        console.error("Failed to load undecided students:", err);
        state.applicants = [];
        state.approved = [];
        state.denied = [];
    }
}

function sortList(list, tableName){
    const { key, dir } = state.sort[tableName];
    const mult = (dir === "asc") ? 1 : -1;
    return [...list].sort((x, y) => compareValues(x[key], y[key]) * mult);
}

function setActiveSortHeader(tableName){
    document.querySelectorAll(`th.sortable[data-table="${tableName}"]`).forEach(th => {
        th.classList.remove("active-sort");
        const caret = th.querySelector(".caret");
        if(caret) caret.textContent = "↕";
    });

    const { key, dir } = state.sort[tableName];
    const active = document.querySelector(`th.sortable[data-table="${tableName}"][data-key="${key}"]`);
    if(active){
        active.classList.add("active-sort");
        const caret = active.querySelector(".caret");
        if(caret) caret.textContent = (dir === "asc") ? "↑" : "↓";
    }
}

// ========= Rendering =========
function renderApplicants(){
    const tbody = document.getElementById("tbody-applicants");
    tbody.innerHTML = "";

    let list = state.applicants;

    // eligibility filter
    if(state.currentEligibilityFilter !== "all"){
        list = list.filter(a => a.eligibilityKey === state.currentEligibilityFilter);
    }

    // sort
    list = sortList(list, "applicants");
    setActiveSortHeader("applicants");

    const totalItems = list.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / state.applicantsPageSize));
    if(state.applicantsPage > totalPages) state.applicantsPage = totalPages;
    if(state.applicantsPage < 1) state.applicantsPage = 1;

    const start = (state.applicantsPage - 1) * state.applicantsPageSize;
    const end = start + state.applicantsPageSize;
    const pageList = list.slice(start, end);

    for(const a of pageList){
        const tr = document.createElement("tr");
        tr.dataset.id = a.id;

        tr.innerHTML = `
      <td>${a.name}</td>
      <td>${a.studentId}</td>
      <td>${a.position}</td>
      <td>${formatDateTime(a.appliedAt)}</td>
      <td class="${eligibilityTdClass(a.eligibilityKey)}">${a.eligibilityText}</td>
      <td><button class="viewbtn" type="button" data-action="view" data-id="${a.id}">View</button></td>
    `;
        tbody.appendChild(tr);
    }

    renderApplicantsPagination(totalPages);
    updateApplicantsCount(pageList.length);
    updatePageSizeDisplay();
}

function renderApproved(){
    const tbody = document.getElementById("tbody-approved");
    tbody.innerHTML = "";

    let list = sortList(state.approved, "approved");
    setActiveSortHeader("approved");

    for(const a of list){
        const tr = document.createElement("tr");
        const canAct = canDecide();
        tr.innerHTML = `
      <td>${a.name}</td>
      <td>${a.studentId}</td>
      <td>${a.position}</td>
      <td>${a.decidedBy || "—"}</td>
      <td>${formatDateTime(a.decidedAt)}</td>
      <td class="${eligibilityTdClass(a.eligibilityKey)}">${a.eligibilityText}</td>
      <td>
        <div class="action-group">
          <button class="viewbtn" type="button" data-action="view" data-id="${a.id}">View</button>
          ${canAct ? `<button class="viewbtn" type="button" data-action="reopen" data-id="${a.id}">Reset decision</button>` : ""}
        </div>
      </td>
    `;
        tbody.appendChild(tr);
    }
}

function renderDenied(){
    const tbody = document.getElementById("tbody-denied");
    tbody.innerHTML = "";

    let list = sortList(state.denied, "denied");
    setActiveSortHeader("denied");

    for(const a of list){
        const tr = document.createElement("tr");
        const canAct = canDecide();
        tr.innerHTML = `
      <td>${a.name}</td>
      <td>${a.studentId}</td>
      <td>${a.position}</td>
      <td>${a.decidedBy || "—"}</td>
      <td>${formatDateTime(a.decidedAt)}</td>
      <td class="${eligibilityTdClass(a.eligibilityKey)}">${a.eligibilityText}</td>
      <td>
        <div class="action-group">
          <button class="viewbtn" type="button" data-action="view" data-id="${a.id}">View</button>
          ${canAct ? `<button class="viewbtn" type="button" data-action="reopen" data-id="${a.id}">Reset decision</button>` : ""}
        </div>
      </td>
    `;
        tbody.appendChild(tr);
    }
}

function renderAll(){
    renderApplicants();
    renderApproved();
    renderDenied();
}

function renderEmployees(){
    const tbody = document.getElementById("tbody-employees");
    if(!tbody) return;
    tbody.innerHTML = "";

    for(const e of state.employees){
        const maxHours = Number(e.maxHoursPerWeek || 0);
        const workedHours = Number(e.workedHoursPerWeek || 0);
        const percent = maxHours > 0 ? Math.round((workedHours / maxHours) * 100) : 0;
        const statusKey = String(e.workStatus || "").toLowerCase().includes("need") ? "issue" : "ok";
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${e.name}</td>
      <td>${e.email}</td>
      <td>${e.phone}</td>
      <td>${e.position}</td>
      <td>${percent}%</td>
      <td><span class="status-pill ${statusKey === "issue" ? "status-issue" : "status-ok"}">${e.workStatus || "No issues"}</span></td>
      <td><button class="viewbtn" type="button" data-action="view-employee" data-id="${e.studentId}">View</button></td>
    `;
        tbody.appendChild(tr);
    }
}

function renderApplicantsPagination(totalPages){
    const wrap = document.getElementById("applicantsPagination");
    if(!wrap) return;
    wrap.innerHTML = "";

    if(totalPages <= 1) return;

    if(state.applicantsPage > 1){
        const prev = document.createElement("button");
        prev.className = "pagebtn";
        prev.type = "button";
        prev.dataset.page = String(state.applicantsPage - 1);
        prev.textContent = "« Prev";
        wrap.appendChild(prev);
    }

    for(let p = 1; p <= totalPages; p++){
        const btn = document.createElement("button");
        btn.className = `pagebtn${p === state.applicantsPage ? " current" : ""}`;
        btn.type = "button";
        btn.dataset.page = String(p);
        btn.textContent = String(p);
        wrap.appendChild(btn);
    }

    if(state.applicantsPage < totalPages){
        const next = document.createElement("button");
        next.className = "pagebtn";
        next.type = "button";
        next.dataset.page = String(state.applicantsPage + 1);
        next.textContent = "Next »";
        wrap.appendChild(next);
    }
}

function updateApplicantsCount(visibleCount){
    const el = document.getElementById("applicantsCount");
    if(!el) return;
    const label = visibleCount === 1 ? "applicant" : "applicants";
    el.textContent = `Showing ${visibleCount} ${label}`;
}

function updatePageSizeDisplay(){
    const el = document.getElementById("pageSizeValue");
    if(!el) return;
    el.textContent = String(state.applicantsPageSize);
}

async function loadDashboardCounts(){
    try{
        const counts = await apiGet("getApplicantCounts");
        const eligibleEl = document.getElementById("dashEligible");
        const actionsEl = document.getElementById("dashActions");
        const ineligibleEl = document.getElementById("dashIneligible");
        if(eligibleEl) eligibleEl.textContent = String(counts.eligible ?? 0);
        if(actionsEl) actionsEl.textContent = String(counts.actions ?? 0);
        if(ineligibleEl) ineligibleEl.textContent = String(counts.ineligible ?? 0);
    } catch (err){
        console.error("Failed to load dashboard counts:", err);
        showErrorToast("Unable to get data.");
    }
}

async function loadEmployees(){
    try{
        const list = await apiGet("getStudentEmployees");
        state.employees = Array.isArray(list) ? list : [];
        renderEmployees();
    } catch (err){
        console.error("Failed to load employees:", err);
        showErrorToast("Unable to get data.");
    }
}

// ========= Views / Nav =========
function setView(view){
    if(!state.currentAdmin){
        showLoginScreen();
        return;
    }
    state.currentView = view;

    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    const map = {
        applicants: "view-applicants",
        approved: "view-approved",
        denied: "view-denied",
        dashboard: "view-dashboard",
        settings: "view-settings",
        employees: "view-employees"
    };
    const el = document.getElementById(map[view]);
    if(el) el.classList.add("active");

    document.querySelectorAll(".nav a[data-view]").forEach(a => a.classList.remove("active"));
    const activeLink = document.querySelector(`.nav a[data-view="${view}"]`);
    if(activeLink) activeLink.classList.add("active");

    const subtitle = document.getElementById("subtitle");
    if(view === "applicants") subtitle.textContent = "Student Hiring • Applicants";
    else if(view === "approved") subtitle.textContent = "Student Hiring • Approved Students";
    else if(view === "denied") subtitle.textContent = "Student Hiring • Denied Students";
    else if(view === "employees") subtitle.textContent = "Student Hiring • Student Employees";
    else subtitle.textContent = "Student Hiring • Admin Portal";

    if(view === "settings") loadEligibilitySettings();
    if(view === "settings") applyAdminFormPermissions();
    if(view === "dashboard") loadDashboardCounts();
    if(view === "employees") loadEmployees();
}

document.querySelectorAll(".nav a[data-view]").forEach(link => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        setView(link.dataset.view);
    });
});

// ========= Modal =========
function openModal(){
    const bd = document.getElementById("modalBackdrop");
    bd.classList.add("open");
    bd.setAttribute("aria-hidden","false");
    document.getElementById("modalCloseBtn").focus();
}
function closeModal(){
    const bd = document.getElementById("modalBackdrop");
    bd.classList.remove("open");
    bd.setAttribute("aria-hidden","true");
    state.selectedApplicantId = null;
}

function openEmployeeModal(){
    const bd = document.getElementById("employeeModalBackdrop");
    bd.classList.add("open");
    bd.setAttribute("aria-hidden","false");
    document.getElementById("employeeModalCloseBtn").focus();
}
function closeEmployeeModal(){
    const bd = document.getElementById("employeeModalBackdrop");
    bd.classList.remove("open");
    bd.setAttribute("aria-hidden","true");
    state.selectedEmployeeId = null;
}

function setEligibilityBadge(statusText, statusKey){
    const el = document.getElementById("mEligibility");
    el.textContent = statusText;
    el.classList.remove("badge-eligible","badge-actions","badge-ineligible");
    el.classList.add(badgeClass(statusKey));
}

function loadModalFromApplicant(applicant){
    document.getElementById("modalTitle").textContent = applicant.name;
    document.getElementById("modalInitials").textContent = getInitials(applicant.name);
    document.getElementById("mAddress").textContent = applicant.address || "—";
    document.getElementById("mAge").textContent = applicant.age ?? "—";
    document.getElementById("mCreditHours").textContent = applicant.creditHours ?? "—";
    document.getElementById("mBirthday").textContent = applicant.birthday || "—";
    document.getElementById("mStudentId").textContent = applicant.studentId || "—";
    document.getElementById("mCitizenship").textContent = applicant.citizenshipISO3 || "—";
    document.getElementById("mEmail").textContent = applicant.email || "—";
    setEligibilityBadge(applicant.eligibilityText || "—", applicant.eligibilityKey || "actions");
    document.getElementById("messageText").value = "";

    const acceptBtn = document.getElementById("acceptBtn");
    const denyBtn = document.getElementById("denyBtn");
    const sendBtn = document.getElementById("sendBtn");
    const allowed = canDecide();
    if(acceptBtn) acceptBtn.disabled = !allowed;
    if(denyBtn) denyBtn.disabled = !allowed;
    if(sendBtn) sendBtn.disabled = !allowed;
}

function loadEmployeeModal(employee){
    document.getElementById("employeeModalTitle").textContent = employee.name;
    document.getElementById("employeeInitials").textContent = getInitials(employee.name);
    document.getElementById("eStudentId").textContent = employee.studentId || "—";
    document.getElementById("ePosition").textContent = employee.position || "—";
    document.getElementById("ePay").textContent = employee.hourlyPay != null ? `$${Number(employee.hourlyPay).toFixed(2)}` : "—";
    document.getElementById("eHireDate").textContent = employee.hireDate || "—";
    document.getElementById("eSupervisor").textContent = employee.supervisor || "—";
    document.getElementById("eEmail").textContent = employee.email || "—";
    document.getElementById("ePhone").textContent = employee.phone || "—";
    document.getElementById("eMaxHours").textContent = employee.maxHoursPerWeek ?? "—";
    document.getElementById("eWorkedHours").textContent = employee.workedHoursPerWeek ?? "—";
    document.getElementById("eWorkStatus").textContent = employee.workStatus || "—";

    const canAct = canDecide();
    const raiseBtn = document.getElementById("raisePayBtn");
    const fireBtn = document.getElementById("fireBtn");
    if(raiseBtn) raiseBtn.disabled = !canAct;
    if(fireBtn) fireBtn.disabled = !canAct;
}

// ========= Actions: Accept / Deny / Send =========
async function decideSelected(decision){
    const id = state.selectedApplicantId;
    if(!id) return;
    if(!state.currentAdmin){
        showLoginScreen();
        return;
    }
    if(!canDecide()){
        showErrorToast("unauthorized");
        return;
    }

    const idx = state.applicants.findIndex(a => a.id === id);
    if(idx === -1) return;

    const applicant = state.applicants[idx];
    let moved = { ...applicant, decidedAt: new Date().toISOString() };

    if(decision === "approved"){
        try{
            moved = await apiPut("acceptStudent", { id, decidedBy: state.currentAdmin.name });
        } catch (err){
            console.error("Failed to accept student:", err);
            return;
        }
    }
    if(decision === "denied"){
        try{
            moved = await apiPut("denyStudent", { id, decidedBy: state.currentAdmin.name });
        } catch (err){
            console.error("Failed to deny student:", err);
            return;
        }
    }

    // remove from applicants
    state.applicants.splice(idx, 1);

    if(decision === "approved") state.approved.unshift(moved);
    if(decision === "denied") state.denied.unshift(moved);

    // re-render lists
    renderAll();

    // close modal
    closeModal();

    // (optional) auto-switch to that list:
    // setView(decision === "approved" ? "approved" : "denied");
}

// ========= Event listeners =========
// View button delegation
document.addEventListener("click", (e) => {
    const viewBtn = e.target.closest('button[data-action="view"]');
    if(!viewBtn) return;

    const id = viewBtn.dataset.id;
    const applicant =
        state.applicants.find(a => a.id === id) ||
        state.approved.find(a => a.id === id) ||
        state.denied.find(a => a.id === id);
    if(!applicant) return;

    state.selectedApplicantId = id;
    loadModalFromApplicant(applicant);
    openModal();
});

// Employee view button delegation
document.addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-action="view-employee"]');
    if(!btn) return;
    const id = btn.dataset.id;
    const employee = state.employees.find(emp => emp.studentId === id);
    if(!employee) return;
    state.selectedEmployeeId = id;
    loadEmployeeModal(employee);
    openEmployeeModal();
});

// Reopen button delegation
document.addEventListener("click", async (e) => {
    const reopenBtn = e.target.closest('button[data-action="reopen"]');
    if(!reopenBtn) return;
    if(!canDecide()){
        showErrorToast("unauthorized");
        return;
    }

    const originalText = "Reset decision";
    const isConfirming = reopenBtn.dataset.confirming === "true";

    if(!isConfirming){
        reopenBtn.dataset.confirming = "true";
        buttonTextWithCountdown(reopenBtn, originalText);
        return;
    }

    const id = reopenBtn.dataset.id;
    if(!id) return;

    reopenBtn.dataset.confirming = "false";
    reopenBtn.textContent = originalText;

    try{
        const reopened = await apiPut("reopenStudent", { id });
        state.approved = state.approved.filter(s => s.id !== id);
        state.denied = state.denied.filter(s => s.id !== id);
        state.applicants.unshift(reopened);
        renderAll();
    } catch (err){
        console.error("Failed to reopen student:", err);
    }
});

// Modal close controls
document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
document.getElementById("modalBackdrop").addEventListener("click", (e) => {
    if(e.target.id === "modalBackdrop") closeModal();
});
document.addEventListener("keydown", (e) => {
    const bd = document.getElementById("modalBackdrop");
    if(!bd.classList.contains("open")) return;
    if(e.key === "Escape") closeModal();
});

// Employee modal close controls
document.getElementById("employeeModalCloseBtn").addEventListener("click", closeEmployeeModal);
document.getElementById("employeeModalBackdrop").addEventListener("click", (e) => {
    if(e.target.id === "employeeModalBackdrop") closeEmployeeModal();
});
document.addEventListener("keydown", (e) => {
    const bd = document.getElementById("employeeModalBackdrop");
    if(!bd.classList.contains("open")) return;
    if(e.key === "Escape") closeEmployeeModal();
});

document.getElementById("acceptBtn").addEventListener("click", () => decideSelected("approved"));
document.getElementById("denyBtn").addEventListener("click", () => decideSelected("denied"));

document.getElementById("sendBtn").addEventListener("click", () => {
    // For now: "send" clears the box
    const box = document.getElementById("messageText");
    box.value = "";
    box.blur();
});

document.getElementById("raisePayBtn").addEventListener("click", async () => {
    if(!state.selectedEmployeeId) return;
    if(!canDecide()){
        showErrorToast("unauthorized");
        return;
    }
    const amountInput = document.getElementById("payIncreaseInput");
    const amount = Number(amountInput?.value);
    if(!Number.isFinite(amount) || amount <= 0){
        showErrorToast("enter a positive amount");
        return;
    }
    try{
        const updated = await apiPut("increasePay", { studentId: state.selectedEmployeeId, amount });
        state.employees = state.employees.map(e => e.studentId === updated.studentId ? updated : e);
        renderEmployees();
        loadEmployeeModal(updated);
        if(amountInput) amountInput.value = "";
    } catch (err){
        console.error("Failed to increase pay:", err);
        showErrorToast("unable to update pay");
    }
});

document.getElementById("fireBtn").addEventListener("click", async () => {
    if(!state.selectedEmployeeId) return;
    if(!canDecide()){
        showErrorToast("unauthorized");
        return;
    }
    try{
        const removed = await apiDelete("fireStudent", { studentId: state.selectedEmployeeId });
        state.employees = state.employees.filter(e => e.studentId !== removed.studentId);
        renderEmployees();
        closeEmployeeModal();
    } catch (err){
        console.error("Failed to fire student:", err);
        showErrorToast("unable to remove student");
    }
});

// Eligibility filter pills
const pills = Array.from(document.querySelectorAll(".pill[data-filter]"));
    pills.forEach(p => {
        p.addEventListener("click", () => {
            pills.forEach(x => x.classList.remove("active"));
            p.classList.add("active");
            state.currentEligibilityFilter = p.dataset.filter;
            state.applicantsPage = 1;
            renderApplicants();
        });
    });

    // Applicants pagination
    const applicantsPagination = document.getElementById("applicantsPagination");
    if(applicantsPagination){
        applicantsPagination.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-page]");
            if(!btn) return;
            const page = Number(btn.dataset.page);
            if(Number.isNaN(page)) return;
            state.applicantsPage = page;
            renderApplicants();
        });
    }

    const pageSizeRange = document.getElementById("pageSizeRange");
    if(pageSizeRange){
        pageSizeRange.addEventListener("input", () => {
            const idx = Number(pageSizeRange.value);
            if(Number.isNaN(idx)) return;
            const nextSize = PAGE_SIZE_OPTIONS[idx] || PAGE_SIZE_OPTIONS[1];
            state.applicantsPageSize = nextSize;
            state.applicantsPage = 1;
            renderApplicants();
        });
    }

// Sort headers (all tables)
document.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
        const table = th.dataset.table; // applicants|approved|denied
        const key = th.dataset.key;

        // toggle direction if same key, else default to asc
        if(state.sort[table].key === key){
            state.sort[table].dir = (state.sort[table].dir === "asc") ? "desc" : "asc";
        } else {
            state.sort[table].key = key;
            state.sort[table].dir = "asc";
        }

        // re-render only the relevant table
        if(table === "applicants") renderApplicants();
        if(table === "approved") renderApproved();
        if(table === "denied") renderDenied();
    });
});

// ========= Initial render =========
const storedAdmin = localStorage.getItem(STORAGE_KEY_ADMIN);
if(storedAdmin){
    try{
        const admin = JSON.parse(storedAdmin);
        if(admin?.name && admin?.token){
            setAdmin(admin);
            showAppShell();
            loadInitialData().then(() => {
                renderAll();
                setView("applicants");
            });
        } else {
            showLoginScreen();
        }
    } catch {
        showLoginScreen();
    }
} else {
    showLoginScreen();
}

const loginForm = document.getElementById("loginForm");
if(loginForm){
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("loginUsername")?.value || "";
        const password = document.getElementById("loginPassword")?.value || "";
        try{
            const admin = await apiPut("login", { username, password });
            if(!admin?.name){
                showErrorToast("unable to login");
                return;
            }
            localStorage.setItem(STORAGE_KEY_ADMIN, JSON.stringify(admin));
            setAdmin(admin);
            showAppShell();
            loadInitialData().then(() => {
                renderAll();
                setView("applicants");
            });
        } catch (err){
            console.error("Login failed:", err);
            showErrorToast("unable to login");
        }
    });
}

const logoutBtn = document.getElementById("logoutBtn");
if(logoutBtn){
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem(STORAGE_KEY_ADMIN);
        state.currentAdmin = null;
        showLoginScreen();
        const userField = document.getElementById("loginUsername");
        const passField = document.getElementById("loginPassword");
        if(userField) userField.value = "";
        if(passField) passField.value = "";
    });
}

function applyTheme(theme){
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY_THEME, theme);
}

const themeToggle = document.getElementById("themeToggle");
if(themeToggle){
    themeToggle.addEventListener("click", () => {
        const current = document.body.getAttribute("data-theme") || "light";
        applyTheme(current === "dark" ? "light" : "dark");
    });
}

const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || "light";
applyTheme(savedTheme);

const eligibilityForm = document.getElementById("eligibilityForm");
if(eligibilityForm){
    eligibilityForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if(state.currentAdmin?.level !== "superadmin"){
            showErrorToast("unauthorized");
            return;
        }
        const minAgeInput = document.getElementById("minAgeInput");
        const minCreditsInput = document.getElementById("minCreditsInput");
        const countriesInput = document.getElementById("allowedCountriesInput");
        const minAge = Number(minAgeInput?.value);
        const minCreditHours = Number(minCreditsInput?.value);
        const allowedCountries = String(countriesInput?.value || "")
            .split(",")
            .map(c => c.toUpperCase().trim())
            .filter(Boolean);

        if(!Number.isFinite(minAge)){
            showErrorToast("invalid minimum age");
            return;
        }
        if(!Number.isFinite(minCreditHours)){
            showErrorToast("invalid minimum credits");
            return;
        }

        try{
            await apiPut("modifyEligibilityRequirements", {
                minAge,
                minCreditHours,
                allowedCountries
            });
            showToast("Eligibility requirements updated.", "ok", () => {});
            loadInitialData().then(renderAll);
        } catch (err){
            console.error("Failed to update eligibility requirements:", err);
            showErrorToast("unable to update eligibility");
        }
    });
}

const adminForm = document.getElementById("adminForm");
if(adminForm){
    adminForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if(state.currentAdmin?.level !== "superadmin"){
            showErrorToast("unauthorized");
            return;
        }
        const name = document.getElementById("adminNameInput")?.value || "";
        const username = document.getElementById("adminUsernameInput")?.value || "";
        const password = document.getElementById("adminPasswordInput")?.value || "";
        const level = document.getElementById("adminLevelSelect")?.value || "";

        if(!name || !username || !password || !level){
            showErrorToast("missing fields");
            return;
        }

        try{
            await apiPut("addAdmin", {
                name,
                username,
                password,
                level
            });
            adminForm.reset();
            showToast("Admin added.", "ok", () => {});
        } catch (err){
            console.error("Failed to add admin:", err);
            showErrorToast("unable to add admin");
        }
    });
}
