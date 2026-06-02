// ═══════════════════════════════════════════════════
// MediaVault — app.js
// ═══════════════════════════════════════════════════

// ══════════════════════════════════════════
// SHIMMER EFFECT
// ══════════════════════════════════════════
function initShimmer() {
    document.querySelectorAll('.shimmer').forEach(el => {
        el.addEventListener('mouseenter', () => {
            el.classList.remove('shimmer-reverse');
            el.classList.add('shimmer-active');
        });
        el.addEventListener('mouseleave', () => {
            el.classList.remove('shimmer-active');
            el.classList.add('shimmer-reverse');
            setTimeout(() => el.classList.remove('shimmer-reverse'), 600);
        });
    });
}

// ══════════════════════════════════════════
// HOMEPAGE — LOOP TEXT
// ══════════════════════════════════════════
const LOOP_TEXTS = ["Seven Categories", "Your Interests", "All In One Place"];
let loopIndex = 0;

function startLoopText() {
    const el = document.getElementById("loop-text");
    if (!el) return;

    setInterval(() => {
        el.classList.add("fade-out");
        setTimeout(() => {
            loopIndex = (loopIndex + 1) % LOOP_TEXTS.length;
            el.textContent = LOOP_TEXTS[loopIndex];
            el.classList.remove("fade-out");
            el.classList.add("fade-in");
            setTimeout(() => el.classList.remove("fade-in"), 350);
        }, 350);
    }, 2500);
}

// ══════════════════════════════════════════
// TRENDING
// ══════════════════════════════════════════
async function loadTrending() {
    const animeEl = document.getElementById("trend-anime");
    if (!animeEl) return;

    const [a, m, mv, tv] = await Promise.allSettled([
        fetchJikanTop("anime", "bypopularity"),
        fetchJikanTop("manga", "bypopularity"),
        fetchTmdbTop("movie", "week"),
        fetchTmdbTop("tv",    "week"),
    ]);

    renderTrending("trend-anime", a.status  === "fulfilled" ? a.value  : []);
    renderTrending("trend-manga", m.status  === "fulfilled" ? m.value  : []);
    renderTrending("trend-movie", mv.status === "fulfilled" ? mv.value : []);
    renderTrending("trend-tv",    tv.status === "fulfilled" ? tv.value : []);
}

async function fetchJikanTop(type, filter) {
    const res  = await fetch(`/api/jikan-top/${type}?filter=${filter}`);
    const data = await res.json();
    return data.results || [];
}

async function fetchTmdbTop(type, window) {
    const res  = await fetch(`/api/tmdb-trending/${type}?window=${window}`);
    const data = await res.json();
    return data.results || [];
}

async function switchTrend(type, filter, btn) {
    const elId = `trend-${type === "anime" ? "anime" : "manga"}`;
    btn.closest('.trend-filters').querySelectorAll('.trend-filter-btn')
       .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.getElementById(elId).innerHTML =
        '<div class="trend-loading">Loading...</div>';

    const results = await fetchJikanTop(type, filter);
    renderTrending(elId, results);
}

async function switchTmdbTrend(type, window, btn) {
    const elId = type === "movie" ? "trend-movie" : "trend-tv";
    btn.closest('.trend-filters').querySelectorAll('.trend-filter-btn')
       .forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.getElementById(elId).innerHTML =
        '<div class="trend-loading">Loading...</div>';

    const results = await fetchTmdbTop(type, window);
    renderTrending(elId, results);
}

function renderTrending(elId, items) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!items.length) {
        el.innerHTML = '<div class="trend-loading">Could not load.</div>';
        return;
    }

    // Determine category from element id
    const catMap = {
        "trend-anime": "anime",
        "trend-manga": "manga",
        "trend-movie": "movie",
        "trend-tv":    "tv",
    };
    const cat = catMap[elId] || "anime";

    el.innerHTML = items.slice(0, 10).map((item, i) => `
        <div class="trend-item">
            onclick="openTrendInfo(
                 ${JSON.stringify(item.title || "")},
                 ${JSON.stringify(cat)},
                 ${JSON.stringify(item.image || "")},
                 ${JSON.stringify(item.score || "")},
                 ${JSON.stringify(item.year  || "")}
            )"
            style="cursor:pointer;">
            <span class="trend-rank ${i < 3 ? 'top' : ''}">#${i + 1}</span>
            ${item.image
                ? `<img src="${item.image}" class="trend-img" alt="" loading="lazy">`
                : `<div class="trend-img-placeholder"></div>`}
            <div class="trend-info">
                <div class="trend-title">${item.title || "Unknown"}</div>
                <div class="trend-meta">${item.year || ""}</div>
            </div>
            ${item.score ? `<span class="trend-score">⭐ ${item.score}</span>` : ""}
        </div>
    `).join("");
}

// ══════════════════════════════════════════
// ADD TO LIBRARY
// ══════════════════════════════════════════
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

// ══════════════════════════════════════════
// UPDATE ITEM
// ══════════════════════════════════════════
async function updateItem(itemId) {
    const status   = document.getElementById("status-select")?.value  || null;
    const progress = document.getElementById("progress-input")?.value;
    const rating   = document.getElementById("rating-input")?.value;

    const payload = {
        status:      status,
        progress:    (progress !== undefined && progress !== "")
                        ? Math.max(0, parseInt(progress)) : null,
        user_rating: (rating !== undefined && rating !== "")
                        ? parseFloat(rating) : null,
    };

    try {
        const res = await fetch(`/api/library/${itemId}`, {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload),
        });
        if (res.ok) {
            showToast("Saved!", "success");
            setTimeout(() => location.reload(), 900);
        } else {
            showToast("Update failed.", "error");
        }
    } catch {
        showToast("Something went wrong.", "error");
    }
}

// ══════════════════════════════════════════
// DELETE ITEM
// ══════════════════════════════════════════
async function deleteItem(itemId) {
    if (!confirm("Remove this from your library?")) return;
    try {
        const res = await fetch(`/api/library/${itemId}`, { method: "DELETE" });
        if (res.ok) {
            showToast("Removed.", "success");
            setTimeout(() => window.location.href = "/library", 900);
        } else {
            showToast("Delete failed.", "error");
        }
    } catch {
        showToast("Something went wrong.", "error");
    }
}

// ══════════════════════════════════════════
// REFRESH TOTAL
// ══════════════════════════════════════════
async function refreshTotal(itemId) {
    const btn = document.querySelector('.btn-refresh');
    if (btn) { btn.textContent = "Refreshing..."; btn.disabled = true; }

    try {
        const res  = await fetch(`/api/library/${itemId}/refresh`, { method: "POST" });
        const data = await res.json();
        if (data.updated) {
            showToast(`Updated: ${data.new_total} total episodes/chapters.`, "success");
            setTimeout(() => location.reload(), 1000);
        } else {
            showToast("Already up to date.", "success");
        }
    } catch {
        showToast("Refresh failed.", "error");
    } finally {
        if (btn) { btn.textContent = "↻ Refresh"; btn.disabled = false; }
    }
}

// ══════════════════════════════════════════
// INFO MODAL
// ══════════════════════════════════════════
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
    document.getElementById("modal-synopsis").textContent = _modalItem.synopsis
                                                            || "No synopsis available.";
    document.getElementById("modal-genres").textContent   = _modalItem.genres;
    document.getElementById("modal-year").textContent     = _modalItem.year;
    document.getElementById("modal-score").textContent    = _modalItem.score
                                                            ? `⭐ ${_modalItem.score}` : "";
    document.getElementById("modal-total").textContent    = _modalItem.total
                                                            ? `${_modalItem.total} ep/ch` : "";

    const cover            = document.getElementById("modal-cover");
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
            showToast("Added!", "success");
        } else {
            btn.textContent = "+ Add to Library";
            btn.disabled    = false;
            showToast(data.detail || "Already in library.", "error");
        }
    } catch {
        btn.disabled    = false;
        btn.textContent = "+ Add to Library";
        showToast("Something went wrong.", "error");
    }
}

// ══════════════════════════════════════════
// TAB SWITCHER
// ══════════════════════════════════════════
function switchTab(tab, btn) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
    document.getElementById(`tab-${tab}`).classList.remove("hidden");
    btn.classList.add("active");
}

// ══════════════════════════════════════════
// MANUAL ENTRY
// ══════════════════════════════════════════
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
        reference_url:   document.getElementById("m-url-slug")?.value.trim()   || null,
        genres:          document.getElementById("m-genres")?.value.trim()      || null,
        cover_image_url: document.getElementById("m-cover")?.value.trim()       || null,
        year_released:   document.getElementById("m-year")?.value
                            ? parseInt(document.getElementById("m-year").value)  : null,
        total:           document.getElementById("m-total")?.value
                            ? parseInt(document.getElementById("m-total").value) : null,
        synopsis:        document.getElementById("m-synopsis")?.value.trim()    || null,
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
                .forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = "";
                });
            tryLoadIframe("");
        } else {
            showToast(data.detail || "Could not add.", "error");
        }
    } catch {
        showToast("Something went wrong.", "error");
    }
}

// ══════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════
function showToast(message, type = "success") {
    const toast       = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.className   = `toast ${type} show`;
    setTimeout(() => { toast.className = `toast ${type}`; }, 3000);
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
    initShimmer();
    startLoopText();
    loadTrending();
    if (document.getElementById("m-category")) updateRefPlaceholder();
});

// ══════════════════════════════════════════
// TRENDING MODAL
// ══════════════════════════════════════════
let _trendItem = {};

async function openTrendInfo(title, category, image, score, year) {
    _trendItem = { title, category, image, score, year };

    document.getElementById("trend-modal-title").textContent    = title;
    document.getElementById("trend-modal-category").textContent = category;
    document.getElementById("trend-modal-score").textContent    = score ? `⭐ ${score}` : "";
    document.getElementById("trend-modal-year").textContent     = year || "";
    document.getElementById("trend-modal-genres").textContent   = "";
    document.getElementById("trend-modal-synopsis").textContent = "Loading...";

    const cover          = document.getElementById("trend-modal-cover");
    cover.src            = image || "";
    cover.style.display  = image ? "block" : "none";

    const addBtn         = document.getElementById("trend-modal-add-btn");
    addBtn.textContent   = "+ Add to Library";
    addBtn.disabled      = false;

    document.getElementById("trend-modal").classList.add("open");
    document.body.style.overflow = "hidden";

    // Fetch full details
    try {
        if (category === "anime" || category === "manga") {
            const type  = category;
            const res   = await fetch(
                `https://api.jikan.moe/v4/${type}?q=${encodeURIComponent(title)}&limit=1`
            );
            const data  = await res.json();
            const item  = data.data?.[0];
            if (item) {
                document.getElementById("trend-modal-synopsis").textContent =
                    item.synopsis || "No synopsis available.";
                document.getElementById("trend-modal-genres").textContent =
                    item.genres?.map(g => g.name).join(", ") || "";
                _trendItem.external_id   = String(item.mal_id);
                _trendItem.source_api    = "jikan";
                _trendItem.genres        = item.genres?.map(g => g.name).join(",") || "";
                _trendItem.synopsis      = item.synopsis || "";
                _trendItem.total         = item.episodes || item.chapters || null;
                _trendItem.reference_url = item.url || "";
            }
        } else {
            // TMDB — use search
            const endpoint = category === "movie" ? "movie" : "tv";
            const res      = await fetch(
                `/api/search?q=${encodeURIComponent(title)}&category=${endpoint === "tv" ? "webseries" : "movie"}`
            );
            const data     = await res.json();
            const item     = data.results?.[0];
            if (item) {
                document.getElementById("trend-modal-synopsis").textContent =
                    item.synopsis || "No synopsis available.";
                document.getElementById("trend-modal-genres").textContent =
                    item.genres || "";
                _trendItem.external_id   = item.external_id;
                _trendItem.source_api    = "tmdb";
                _trendItem.genres        = item.genres || "";
                _trendItem.synopsis      = item.synopsis || "";
                _trendItem.total         = item.total || null;
                _trendItem.reference_url = item.reference_url || "";
                _trendItem.cover         = item.cover_image_url || image;
            }
        }
    } catch {
        document.getElementById("trend-modal-synopsis").textContent =
            "Could not load details.";
    }
}

function closeTrendModal(event) {
    if (event && event.target !== document.getElementById("trend-modal")) return;
    document.getElementById("trend-modal").classList.remove("open");
    document.body.style.overflow = "";
}

async function addFromTrendModal() {
    const btn        = document.getElementById("trend-modal-add-btn");
    btn.disabled     = true;
    btn.textContent  = "Adding...";

    const catMap = { anime: "anime", manga: "manga", movie: "movie", tv: "webseries" };

    const payload = {
        title:           _trendItem.title,
        category:        catMap[_trendItem.category] || _trendItem.category,
        external_id:     _trendItem.external_id   || null,
        source_api:      _trendItem.source_api     || null,
        cover_image_url: _trendItem.cover          || _trendItem.image || null,
        synopsis:        _trendItem.synopsis       || null,
        year_released:   _trendItem.year           ? parseInt(_trendItem.year) : null,
        genres:          _trendItem.genres         || null,
        total:           _trendItem.total          || null,
        reference_url:   _trendItem.reference_url  || null,
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
            btn.textContent = "+ Add to Library";
            btn.disabled    = false;
            showToast(data.detail || "Already in library.", "error");
        }
    } catch {
        btn.disabled    = false;
        btn.textContent = "+ Add to Library";
        showToast("Something went wrong.", "error");
    }
}