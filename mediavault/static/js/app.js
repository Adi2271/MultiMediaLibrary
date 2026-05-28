// app.js — Minimum JS, 3 responsibilities only:
// 1. Search: fetch() on submit, render result cards into #search-results
// 2. Add to Library: fetch() POST on button click, show confirmation
// 3. Progress/Status update: fetch() PATCH inline, no page reload
//
// All other UI (library, timeline, filters) = Jinja2 full-page renders
// Task 1: Add to Library
// ── Task 1: Add to Library ─────────────────────────────────────────────────
async function addToLibrary(btn) {
    btn.disabled    = true;
    btn.textContent = "Adding...";

    const payload = {
        title:           btn.dataset.title,
        category:        btn.dataset.category,
        external_id:     btn.dataset.externalId   || null,
        source_api:      btn.dataset.sourceApi     || null,
        cover_image_url: btn.dataset.cover         || null,
        synopsis:        btn.dataset.synopsis      || null,
        year_released:   btn.dataset.year          ? parseInt(btn.dataset.year)  : null,
        genres:          btn.dataset.genres        || null,
        total:           btn.dataset.total         ? parseInt(btn.dataset.total) : null,
        reference_url:   btn.dataset.referenceUrl  || null,
    };

    try {
        const res  = await fetch("/api/library", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload),
        });
        const data = await res.json();

        if (res.ok) {
            btn.textContent = "✓ Added";
            showToast("Added to library!", "success");
        } else {
            btn.textContent = "Already Added";
            showToast(data.detail || "Already in library.", "error");
        }
    } catch {
        btn.disabled    = false;
        btn.textContent = "+ Add to Library";
        showToast("Something went wrong.", "error");
    }
}

// ── Task 2: Update progress, status, rating ────────────────────────────────
async function updateItem(itemId) {
    const status   = document.getElementById("status-select")?.value  || null;
    const progress = document.getElementById("progress-input")?.value;
    const rating   = document.getElementById("rating-input")?.value;

    const payload = {
        status:      status,
        progress:    progress ? parseInt(progress) : null,
        user_rating: rating   ? parseFloat(rating) : null,
    };

    try {
        const res  = await fetch(`/api/library/${itemId}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload),
        });
        const data = await res.json();

        if (res.ok) {
            showToast("Saved!", "success");
            setTimeout(() => location.reload(), 1000);
        } else {
            showToast("Update failed.", "error");
        }
    } catch {
        showToast("Something went wrong.", "error");
    }
}

// ── Task 3: Delete item ────────────────────────────────────────────────────
async function deleteItem(itemId) {
    if (!confirm("Remove this from your library?")) return;

    try {
        const res = await fetch(`/api/library/${itemId}`, { method: "DELETE" });

        if (res.ok) {
            showToast("Removed.", "success");
            setTimeout(() => window.location.href = "/library", 1000);
        } else {
            showToast("Delete failed.", "error");
        }
    } catch {
        showToast("Something went wrong.", "error");
    }
}

// ── Toast notification ─────────────────────────────────────────────────────
function showToast(message, type = "success") {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast          = document.createElement("div");
        toast.id       = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className   = `toast ${type} show`;
    setTimeout(() => { toast.className = `toast ${type}`; }, 3000);
}