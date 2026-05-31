// ═══════════════════════════════════════════════════
// MediaVault — app.js
// Tasks: trending, add to library, update, modal, manual entry
// ═══════════════════════════════════════════════════

// ── Trending (Homepage) ───────────────────────────────────────────────────
async function loadTrending() {
    const animeEl = document.getElementById("trend-anime");
    const mangaEl = document.getElementById("trend-manga");
    const movieEl = document.getElementById("trend-movie");
    const tvEl    = document.getElementById("trend-tv");

    if (!animeEl) return; // Not on homepage

    const [animeData, mangaData, movieData, tvData] = await Promise.allSettled([
        fetchJikanTop("anime"),
        fetchJikanTop("manga"),
        fetchTmdbTop("movie"),
        fetchTmdbTop("tv"),
    ]);

    renderTrending(animeEl, animeData.status === "fulfilled" ? animeData.value : []);
    renderTrending(mangaEl, mangaData.status === "fulfilled" ? mangaData.value : []);
    renderTrending(movieEl, movieData.status === "fulfilled" ? movieData.value : []);
    renderTrending(tvEl,    tvData.status   === "fulfilled" ? tvData.value   : []);
}

async function fetchJikanTop(type) {
    const res  = await fetch(`https://api.jikan.moe/v4/top/${type}?limit=10&filter=bypopularity`);
    const data = await res.json();
    return (data.data || []).map(item => ({
        title: item.title_english || item.title,
        score: item.score,
        image: item.images?.jpg?.image_url || null,
        year:  item.year || (item.published?.prop?.from?.year) || null,
    }));
}

async function fetchTmdbTop(type) {
    const res  = await fetch(`/api/tmdb-trending/${type}`);
    const data = await res.json();
    return data.results || [];
}

function renderTrending(el, items) {
    if (!items.length) {
        el.innerHTML = `<div class="trend-loading">Could not load.</div>`;
        return;
    }
    el.innerHTML = items.slice(0, 10).map((item, i) => `
        <div class="trend-item">
            <span class="trend-rank ${i < 3 ? 'top' : ''}">#${i + 1}</span>
            ${item.image
                ? `<img src="${item.image}" class="trend-img" alt="" loading="lazy">`
                : `<div class="trend-img-placeholder"></div>`}
            <div class="trend-info">
                <div class="trend-title">${item.title || item.name || "Unknown"}</div>
                <div class="trend-meta">${item.year || ""}</div>
            </div>
            ${item.score ? `<span class="trend-score">⭐ ${item.score}</span>` : ""}
        </div>
    `).join("");
}

// ── Add to Library ────────────────────────────────────────────────────────
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
        btn.textContent = "+ Add";
        showToast("Something went wrong.", "error");
    }
}

// ── Update Progress / Status / Rating ─────────────────────────────────────
async function updateItem(itemId) {
    const status   = document.getElementById("status-select")?.value  || null;
    const progress = document.getElementById("progress-input")?.value;
    const rating   = document.getElementById("rating-input")?.value;

    const payload = {
        status:      status,
        progress:    progress !== "" ? Math.max(0, parseInt(progress)) : null,
        user_rating: rating   !== "" ? parseFloat(rating) : null,
    };

    try {
        const res = await fetch(`/api/library/${itemId}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload),
        });
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

// ── Delete Item ────────────────────────────────────────────────────────────
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

// ── Info Modal ────────────────────────────────────────────────────────────
let _modalItem = {};

function openInfo(btn) {
    _modalItem = {
        title:         btn.dataset.title,
        category:      btn.dataset.category,
        external_id:   btn.dataset.externalId   || null,
        source_api:    btn.dataset.sourceApi     || null,
        cover:         btn.dataset.cover         || null,
        synopsis:      btn.dataset.synopsis      || "",
        year:          btn.dataset.year          || "",
        genres:        btn.dataset.genres        || "",
        total:         btn.dataset.total         || "",
        reference_url: btn.dataset.referenceUrl  || null,
        score:         btn.dataset.score         || "",
    };

    document.getElementById("modal-title").textContent    = _modalItem.title;
    document.getElementById("modal-category").textContent = _modalItem.category;
    document.getElementById("modal-synopsis").textContent = _modalItem.synopsis || "No synopsis available.";
    document.getElementById("modal-genres").textContent   = _modalItem.genres;
    document.getElementById("modal-year").textContent     = _modalItem.year;
    document.getElementById("modal-score").textContent    = _modalItem.score ? `⭐ ${_modalItem.score}` : "";
    document.getElementById("modal-total").textContent    = _modalItem.total ? `${_modalItem.total} ep/ch` : "";

    const cover = document.getElementById("modal-cover");
    cover.src              = _modalItem.cover || "";
    cover.style.display    = _modalItem.cover ? "block" : "none";

    const addBtn           = document.getElementById("modal-add-btn");
    addBtn.textContent     = "+ Add to Library";
    addBtn.disabled        = false;

    const refLink          = document.getElementById("modal-ref");
    refLink.href           = _modalItem.reference_url || "#";
    refLink.style.display  = _modalItem.reference_url ? "inline" : "none";

    document.getElementById("info-modal").classList.add("open");
    document.body.style.overflow = "hidden";
}

function closeInfoModal() {
    document.getElementById("info-modal").classList.remove("open");
    document.body.style.overflow = "";
}

function closeModal(event) {
    if (event.target === document.getElementById("info-modal")) closeInfoModal();
}

document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeInfoModal();
});

async function addFromModal() {
    const btn      = document.getElementById("modal-add-btn");
    btn.disabled   = true;
    btn.textContent = "Adding...";

    const payload = {
        title:           _modalItem.title,
        category:        _modalItem.category,
        external_id:     _modalItem.external_id  || null,
        source_api:      _modalItem.source_api    || null,
        cover_image_url: _modalItem.cover         || null,
        synopsis:        _modalItem.synopsis      || null,
        year_released:   _modalItem.year          ? parseInt(_modalItem.year)  : null,
        genres:          _modalItem.genres        || null,
        total:           _modalItem.total         ? parseInt(_modalItem.total) : null,
        reference_url:   _modalItem.reference_url || null,
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
            btn.disabled    = false;
            showToast(data.detail || "Already in library.", "error");
        }
    } catch {
        btn.disabled    = false;
        btn.textContent = "+ Add to Library";
        showToast("Something went wrong.", "error");
    }
}

// ── Tab Switcher ──────────────────────────────────────────────────────────
function switchTab(tab, btn) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
    document.getElementById(`tab-${tab}`).classList.remove("hidden");
    btn.classList.add("active");
}

// ── Manual Entry ──────────────────────────────────────────────────────────
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
    const cat    = document.getElementById("m-category")?.value;
    const site   = REF_SITES[cat];
    const prefix = document.getElementById("ref-prefix");
    const hint   = document.getElementById("ref-hint");
    if (site && prefix) {
        prefix.textContent = site.prefix;
        prefix.onclick     = () => window.open(site.prefix, "_blank");
        if (hint) hint.textContent = `Click prefix to browse ${site.label}`;
    }
}

async function submitManual() {
    const title = document.getElementById("m-title")?.value.trim();
    const cat   = document.getElementById("m-category")?.value;
    if (!title) { showToast("Title is required.", "error"); return; }

    const payload = {
        title,
        category:        cat,
        source_api:      "manual",
        reference_url:   document.getElementById("m-url-slug")?.value.trim()  || null,
        genres:          document.getElementById("m-genres")?.value.trim()     || null,
        cover_image_url: document.getElementById("m-cover")?.value.trim()      || null,
        year_released:   document.getElementById("m-year")?.value
                            ? parseInt(document.getElementById("m-year").value) : null,
        total:           document.getElementById("m-total")?.value
                            ? parseInt(document.getElementById("m-total").value) : null,
        synopsis:        document.getElementById("m-synopsis")?.value.trim()   || null,
    };

    try {
        const res  = await fetch("/api/library", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
            showToast(`"${title}" added!`, "success");
            ["m-title","m-url-slug","m-genres","m-cover","m-year","m-total","m-synopsis"]
                .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
        } else {
            showToast(data.detail || "Could not add.", "error");
        }
    } catch {
        showToast("Something went wrong.", "error");
    }
}

// ── Toast ─────────────────────────────────────────────────────────────────
function showToast(message, type = "success") {
    const toast       = document.getElementById("toast");
    toast.textContent = message;
    toast.className   = `toast ${type} show`;
    setTimeout(() => { toast.className = `toast ${type}`; }, 3000);
}

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    loadTrending();
    if (document.getElementById("m-category")) updateRefPlaceholder();
});