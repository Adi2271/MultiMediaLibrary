// app.js — Minimum JS, 3 responsibilities only:
// 1. Search: fetch() on submit, render result cards into #search-results
// 2. Add to Library: fetch() POST on button click, show confirmation
// 3. Progress/Status update: fetch() PATCH inline, no page reload
//
// All other UI (library, timeline, filters) = Jinja2 full-page renders
// Task 1: Add to Library
async function addToLibrary(btn) {
    btn.disabled = true;
    btn.textContent = "Adding...";

    const payload = {
        title:           btn.dataset.title,
        category:        btn.dataset.category,
        external_id:     btn.dataset.externalId,
        source_api:      btn.dataset.sourceApi,
        cover_image_url: btn.dataset.cover,
        synopsis:        btn.dataset.synopsis,
        year_released:   btn.dataset.year    ? parseInt(btn.dataset.year)  : null,
        genres:          btn.dataset.genres,
        total:           btn.dataset.total   ? parseInt(btn.dataset.total) : null,
        reference_url:   btn.dataset.referenceUrl,
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

// Task 2: Toast notification
function showToast(message, type = "success") {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className   = `toast ${type} show`;
    setTimeout(() => { toast.className = `toast ${type}`; }, 3000);
}

// Task 3: Progress + Status update (used in library page — Step 3)