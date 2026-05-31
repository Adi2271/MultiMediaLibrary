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
        progress: progress !== "" ? Math.max(0, parseInt(progress)) : null,
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

// ── Tab switcher (Search vs Manual) ───────────────────────────────────────
function switchTab(tab, btn) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));

    document.getElementById(`tab-${tab}`).classList.remove("hidden");
    btn.classList.add("active");
}

// ── Manual Entry submission ────────────────────────────────────────────────
async function submitManual() {
    const title = document.getElementById("m-title").value.trim();
    const cat   = document.getElementById("m-category").value;

    if (!title) {
        showToast("Title is required.", "error");
        return;
    }

    const payload = {
        title:           title,
        category:        cat,
        source_api:      "manual",
        reference_url: document.getElementById("m-url-slug")?.value.trim() || null,
        genres:          document.getElementById("m-genres").value.trim()  || null,
        cover_image_url: document.getElementById("m-cover").value.trim()   || null,
        year_released:   document.getElementById("m-year").value
                            ? parseInt(document.getElementById("m-year").value)
                            : null,
        total:           document.getElementById("m-total").value
                            ? parseInt(document.getElementById("m-total").value)
                            : null,
        synopsis:        document.getElementById("m-synopsis").value.trim() || null,
    };

    try {
        const res  = await fetch("/api/library", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload),
        });
        const data = await res.json();

        if (res.ok) {
            showToast(`"${title}" added to library!`, "success");
            // Clear form
            ["m-title","m-url","m-genres","m-cover",
             "m-year","m-total","m-synopsis"].forEach(id => {
                document.getElementById(id).value = "";
            });
        } else {
            showToast(data.detail || "Could not add.", "error");
        }
    } catch {
        showToast("Something went wrong.", "error");
    }
}

const REF_SITES = {
    manga:    { prefix: "https://myanimelist.net/manga/",    label: "MAL Manga" },
    manhwa:   { prefix: "https://www.webtoons.com/en/",      label: "Webtoons" },
    webnovel: { prefix: "https://www.webnovel.com/book/",    label: "Webnovel" },
    book:     { prefix: "https://www.goodreads.com/book/",   label: "Goodreads" },
    anime:    { prefix: "https://myanimelist.net/anime/",    label: "MAL Anime" },
    movie:    { prefix: "https://www.themoviedb.org/movie/", label: "TMDB Movie" },
    webseries:{ prefix: "https://www.themoviedb.org/tv/",    label: "TMDB TV" },
};

function updateRefPlaceholder() {
    const cat    = document.getElementById("m-category").value;
    const site   = REF_SITES[cat];
    const prefix = document.getElementById("ref-prefix");
    const hint   = document.getElementById("ref-hint");
    if (site && prefix) {
        prefix.textContent = site.prefix;
        prefix.onclick     = () => window.open(site.prefix, "_blank");
        if (hint) hint.textContent = `Click the prefix to browse ${site.label}`;
    }
}

// Update submitManual to read from slug input
// Inside submitManual, replace reference_url line with:
// reference_url: document.getElementById("m-url-slug")?.value.trim() || null,

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("m-category")) {
        updateRefPlaceholder();
    }
});
