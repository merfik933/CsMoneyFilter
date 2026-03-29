console.log("Hello from content.js");

function logInfo(msg, data) {
    if (data !== undefined) {
        console.log(`[CF] ${msg}`, data);
    } else {
        console.log(`[CF] ${msg}`);
    }
}

function logError(msg, err) {
    if (err !== undefined) {
        console.error(`[CF][ERR] ${msg}`, err);
    } else {
        console.error(`[CF][ERR] ${msg}`);
    }
}

let discountRanges = [{ min: 0, max: 100, color: "#1e365c", buy: false }];

let is_image_url_checked = false;
let image_url_filter_type = "blacklist";
let image_urls = {};

let is_image_url_id_checked = false;
let image_id_urls = {};
let filterActive = false;
let randomReloadMin = 5;
let randomReloadMax = 15;
let autoBuyEnabled = false;
let reloadTimeoutId = null;
let purchaseHistory = {};
let clicksRemainingThisCycle = 0;
let cartFlowInProgress = false;
let addedThisCycle = false;
let cycleInProgress = false;
let hardReloadIntervalMs = 20 * 60 * 1000;
let lastHardReload = Date.now();
let monitoringOrigin = null;
let ignore1mTag = true;
const MONITORING_SESSION_KEY = "cf_monitoring_session_token";
const MAX_CYCLE_AUTOBUY_CLICKS = 50;
const MAX_PURCHASE_ROUNDS_PER_CYCLE = 8;

const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;

loadPurchaseHistory();
restoreMonitoringState();

function getProductCards() {
    const selectors = [
        "[data-card-item-id]",
        "[data-card-id]",
        "[data-card-price]"
    ];

    for (const selector of selectors) {
        const nodes = document.querySelectorAll(selector);
        if (nodes.length > 0) {
            return nodes;
        }
    }

    return [];
}

function getDiscountValue(product) {
    const discountCandidates = product.querySelectorAll('[class*="Tag-module_content"]');
    for (const candidate of discountCandidates) {
        const text = candidate.innerText || "";
        if (text.includes("%")) {
            const value = parseInt(text.replace("%", "").replace("-", "").trim(), 10);
            if (!Number.isNaN(value)) {
                return value;
            }
        }
    }

    return 0;
}

function getImageSrc(product) {
    const image = product.querySelector(
        "img.csm_3f4a05c6, img.csm_64196821, img[src*='steamcommunity'], img[src*='assets.cs.money']"
    );
    return image ? image.src : null;
}

function getMvElements(product) {
    return product.querySelectorAll("span");
}

function findBackgroundElement(product) {
    const selectors = [
        ".csm_06d323e9.csm_157c9c46",
        "[data-card-id]",
        ".csm_3a2fd55b.csm_26f79334",
        ".csm_8caf403e"
    ];

    for (const selector of selectors) {
        const element = product.querySelector(selector);
        if (element) {
            return element;
        }
    }

    const candidates = product.querySelectorAll("div");
    for (const candidate of candidates) {
        const bg = getComputedStyle(candidate).backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
            return candidate;
        }
    }

    return product;
}

function getProductId(product) {
    return product.getAttribute("data-card-item-id") || product.getAttribute("data-card-id");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "applyFilter") {
        const incomingOrigin = message.monitoring_origin || window.location.origin;
        if (incomingOrigin !== window.location.origin) {
            logInfo("applyFilter ignored for different origin", { incomingOrigin, currentOrigin: window.location.origin });
            return;
        }

        monitoringOrigin = incomingOrigin;

        filterActive = message.monitoringActive !== undefined ? Boolean(message.monitoringActive) : true;
        discountRanges = Array.isArray(message.discount_ranges) && message.discount_ranges.length > 0
            ? message.discount_ranges
            : discountRanges;

        is_image_url_checked = message.is_image_url_checked;
        image_url_filter_type = message.image_url_filter_type;
        const image_urls_string = message.image_urls || [];
        image_urls = {};
        image_urls_string.forEach((url) => {
            const elements = url.split(";");
            if (elements.length > 1) {
                image_urls[elements[0]] = elements.slice(1);
            } else {
                image_urls[url] = [];
            }
        });

        is_image_url_id_checked = message.is_image_url_id_checked;
        image_id_urls = message.image_id_urls;
        autoBuyEnabled = Boolean(message.auto_buy_enabled);
        ignore1mTag = message.ignore_1m_tag !== undefined ? Boolean(message.ignore_1m_tag) : true;
        const incomingSessionToken = typeof message.monitoring_session_token === "string"
            ? message.monitoring_session_token
            : null;

        if (filterActive) {
            const tokenToPersist = incomingSessionToken || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            sessionStorage.setItem(MONITORING_SESSION_KEY, tokenToPersist);
        } else {
            sessionStorage.removeItem(MONITORING_SESSION_KEY);
        }

        if (typeof message.hard_reload_minutes === "number" && message.hard_reload_minutes >= 0) {
            hardReloadIntervalMs = message.hard_reload_minutes * 60 * 1000;
        }
        lastHardReload = Date.now();

        if (typeof message.random_reload_min === "number") {
            randomReloadMin = Math.max(0, message.random_reload_min);
        }
        if (typeof message.random_reload_max === "number") {
            randomReloadMax = Math.max(randomReloadMin, message.random_reload_max);
        }

        if (!filterActive) {
            clicksRemainingThisCycle = 0;
            clearPendingReload();
        } else {
            clicksRemainingThisCycle = 5;
            scheduleNextReload();
        }

        filterProducts();
        return;
    }

    if (message.action === "getMonitoringState") {
        sendResponse({ monitoringActive: filterActive });
    }

    if (message.action === "clearPurchaseHistory") {
        purchaseHistory = {};
        chrome.storage.local.set({ purchase_history: purchaseHistory });
    }
});

function clearPendingReload() {
    if (reloadTimeoutId) {
        clearTimeout(reloadTimeoutId);
        reloadTimeoutId = null;
    }
}

function scheduleNextReload() {
    clearPendingReload();
    if (!filterActive) {
        return;
    }
    const minMs = randomReloadMin * 1000;
    const maxMs = randomReloadMax * 1000;
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    reloadTimeoutId = setTimeout(() => {
        startReloadCycle();
    }, delay);
    logInfo("Next reload scheduled", { delayMs: delay });
}

async function startReloadCycle() {
    if (!filterActive || cycleInProgress) {
        return;
    }
    if (monitoringOrigin && monitoringOrigin !== window.location.origin) {
        logInfo("startReloadCycle skipped: origin mismatch", { monitoringOrigin, currentOrigin: window.location.origin });
        return;
    }
    if (hardReloadIntervalMs > 0 && Date.now() - lastHardReload >= hardReloadIntervalMs) {
        lastHardReload = Date.now();
        logInfo("Hard reload to recover resources", { intervalMs: hardReloadIntervalMs });
        window.location.reload();
        return;
    }
    cycleInProgress = true;
    try {
        const hasPendingBeforeReload = autoBuyEnabled && (cartHasItems() || hasPendingAutoBuyCandidates());
        if (hasPendingBeforeReload) {
            logInfo("Reload skipped because pending purchases exist");
        } else {
            await tryReload();
        }

        await processPurchasesUntilSettled();
    } finally {
        cycleInProgress = false;
        scheduleNextReload();
    }
}

async function processPurchasesUntilSettled() {
    if (!autoBuyEnabled) {
        return;
    }

    for (let round = 1; round <= MAX_PURCHASE_ROUNDS_PER_CYCLE; round++) {
        clicksRemainingThisCycle = MAX_CYCLE_AUTOBUY_CLICKS;
        addedThisCycle = false;
        const passResult = filterProducts();

        await delay(350);
        await handleCartOverflowIfNeeded();
        await delay(350);

        if (addedThisCycle || cartHasItems()) {
            await runPurchaseFlow();
            await delay(600);
        }

        const stillHasCandidates = hasPendingAutoBuyCandidates();
        const stillHasCartItems = cartHasItems();
        if (!stillHasCandidates && !stillHasCartItems && (!passResult || passResult.addedCount === 0)) {
            logInfo("Purchase settle completed", { round });
            return;
        }
    }

    logInfo("Purchase settle reached max rounds", { maxRounds: MAX_PURCHASE_ROUNDS_PER_CYCLE });
}

async function tryReload() {
    clicksRemainingThisCycle = MAX_CYCLE_AUTOBUY_CLICKS;
    addedThisCycle = false;
    const reloadButton = document.querySelector("[aria-label='Refresh results']");
    if (reloadButton) {
        await safeClick(reloadButton).catch((e) => logError("Reload button click failed", e));
    }
    logInfo("Reload triggered");
}

function hasIgnoredWearTag(product) {
    if (!ignore1mTag) {
        return false;
    }

    const tagNodes = product.querySelectorAll("span[class*='Tag-module_content']");
    for (const node of tagNodes) {
        const tagText = (node.innerText || "").trim().toLowerCase();
        if (tagText === "1m") {
            return true;
        }
    }
    return false;
}

function evaluateProductMatch(product) {
    let shouldHighlight = false;
    let matchedRange = null;
    let matchedRangeColor = null;

    if (hasIgnoredWearTag(product)) {
        return { shouldHighlight: false, matchedRange: null, matchedRangeColor: null };
    }

    const discount = getDiscountValue(product);
    for (const range of discountRanges) {
        if (discount >= range.min && discount <= range.max) {
            matchedRangeColor = range.color;
            matchedRange = range;
            break;
        }
    }
    shouldHighlight = matchedRangeColor !== null;

    if (shouldHighlight && is_image_url_checked) {
        const imageElementSrc = getImageSrc(product);
        const mvElements = getMvElements(product);

        if (image_url_filter_type === "blacklist") {
            let isInBlacklist = false;
            for (const [url, mvs] of Object.entries(image_urls)) {
                if (imageElementSrc && imageElementSrc.includes(url)) {
                    if (mvs.length !== 0) {
                        mvs.forEach((mv) => {
                            if (mvElements) {
                                mvElements.forEach((mvElement) => {
                                    if (mvElement.innerText.includes(mv)) {
                                        isInBlacklist = true;
                                    }
                                });
                            }
                        });
                    } else {
                        isInBlacklist = true;
                    }
                }
            }
            shouldHighlight = !isInBlacklist;
        } else if (image_url_filter_type === "whitelist") {
            let isWhitelisted = false;
            for (const [url, mvs] of Object.entries(image_urls)) {
                if (imageElementSrc && imageElementSrc.includes(url)) {
                    if (mvs.length !== 0) {
                        mvs.forEach((mv) => {
                            if (mvElements) {
                                mvElements.forEach((mvElement) => {
                                    if (mvElement.innerText.includes(mv)) {
                                        isWhitelisted = true;
                                    }
                                });
                            }
                        });
                    } else {
                        isWhitelisted = true;
                    }
                }
            }
            shouldHighlight = isWhitelisted;
        }
    }

    if (shouldHighlight && is_image_url_id_checked) {
        const id = getProductId(product);
        if (id && image_id_urls.includes(id)) {
            shouldHighlight = false;
        }
    }

    return { shouldHighlight, matchedRange, matchedRangeColor };
}

function hasPendingAutoBuyCandidates() {
    if (!autoBuyEnabled) {
        return false;
    }

    const products = getProductCards();
    for (const product of products) {
        const productId = getProductId(product);
        if (productId && isRecentlyPurchased(productId)) {
            continue;
        }

        const { shouldHighlight, matchedRange } = evaluateProductMatch(product);
        if (!shouldHighlight || !matchedRange || matchedRange.buy !== true) {
            continue;
        }

        const addButton = product.querySelector("[aria-label='Add item to cart']");
        if (addButton) {
            return true;
        }
    }

    return false;
}

function filterProducts() {
    if (!filterActive) {
        return { addedCount: 0 };
    }
    
    let products = getProductCards();
    let addedCount = 0;
    
    products.forEach((product) => {
        const productId = getProductId(product);
        const { shouldHighlight, matchedRange, matchedRangeColor } = evaluateProductMatch(product);

        // Застосовуємо виділення
        const bgElement = findBackgroundElement(product);
        if (bgElement) {
            if (shouldHighlight) {
                bgElement.style.backgroundColor = matchedRangeColor;
            } else {
                bgElement.style.backgroundColor = "";
            }

            const isPurchased = productId && isRecentlyPurchased(productId);
            bgElement.style.filter = isPurchased ? "brightness(0.65)" : "";
        }

        if (autoBuyEnabled && shouldHighlight && matchedRange && matchedRange.buy === true && clicksRemainingThisCycle > 0) {
            if (productId && !isRecentlyPurchased(productId)) {
                const addButton = product.querySelector("[aria-label='Add item to cart']");
                if (addButton) {
                    safeClick(addButton).catch((e) => logError("Add to cart click failed", e));
                    recordPurchase(productId);
                    clicksRemainingThisCycle -= 1;
                    addedThisCycle = true;
                    addedCount += 1;
                    logInfo("Item added to cart", { productId, remainingClicks: clicksRemainingThisCycle });
                }
            }
        }

        // Додаємо кнопку видалення (для чорного списку ID)
        const buttonDelete = product.querySelector(".deleteButton") 
        if (!buttonDelete) {
            const button = document.createElement("button");
            button.className = "deleteButton";
            button.innerText = "X";
            button.style.backgroundColor = "red";
            button.style.width = "30px";
            button.style.height = "30px";
            button.style.position = "absolute";
            button.style.top = "0";
            button.style.left = "0";
            button.style.borderRadius = "5px";
            button.style.color = "#fff";
            button.style.backgroundColor = "#D2042D";
            button.style.boxShadow = "none";
            button.style.cursor = "pointer";
            button.addEventListener("click", () => {
                const id = getProductId(product);
                if (!id) {
                    return;
                }
                chrome.storage.local.get(["image_id_urls"], (data) => {
                    const storedIds = Array.isArray(data.image_id_urls) ? data.image_id_urls : [];
                    if (!storedIds.includes(id)) {
                        storedIds.push(id);
                    }
                    image_id_urls = storedIds;

                    chrome.storage.local.set({ image_id_urls: storedIds });
                    chrome.runtime.sendMessage({ action: "updateIDList", id: storedIds });

                    const bgElement = findBackgroundElement(product);
                    if (bgElement) {
                        bgElement.style.backgroundColor = "";
                    }

                    filterProducts();
                });
            });
            product.style.position = "relative";
            product.appendChild(button);
        }
    });

    return { addedCount };
}

function loadPurchaseHistory() {
    chrome.storage.local.get(["purchase_history"], (data) => {
        const stored = sanitizeHistory(data.purchase_history);
        purchaseHistory = stored;
        pruneOldHistory();
        logInfo("Purchase history loaded", { count: Object.keys(purchaseHistory).length });
    });
}

function sanitizeHistory(raw) {
    if (!raw || typeof raw !== "object") {
        return {};
    }
    const now = Date.now();
    const cleaned = {};
    Object.entries(raw).forEach(([id, ts]) => {
        if (typeof ts === "number" && now - ts < HISTORY_TTL_MS) {
            cleaned[id] = ts;
        }
    });
    return cleaned;
}

function pruneOldHistory() {
    const now = Date.now();
    let changed = false;
    Object.entries(purchaseHistory).forEach(([id, ts]) => {
        if (now - ts >= HISTORY_TTL_MS) {
            delete purchaseHistory[id];
            changed = true;
        }
    });
    if (changed) {
        chrome.storage.local.set({ purchase_history: purchaseHistory });
    }
}

function isRecentlyPurchased(id) {
    if (!purchaseHistory[id]) {
        return false;
    }
    const age = Date.now() - purchaseHistory[id];
    return age < HISTORY_TTL_MS;
}

function recordPurchase(id) {
    purchaseHistory[id] = Date.now();
    chrome.storage.local.set({ purchase_history: purchaseHistory });
}

function getNavigationType() {
    try {
        const entries = performance.getEntriesByType("navigation");
        if (entries && entries.length > 0 && entries[0].type) {
            return entries[0].type;
        }
    } catch (e) {
        logError("Failed to read navigation entries", e);
    }

    if (performance && performance.navigation) {
        if (performance.navigation.type === 1) {
            return "reload";
        }
        if (performance.navigation.type === 0) {
            return "navigate";
        }
    }

    return "navigate";
}

function restoreMonitoringState() {
    chrome.storage.local.get([
        "monitoring_active",
        "monitoring_origin",
        "discount_ranges",
        "is_image_url_checked",
        "image_url_filter_type",
        "image_urls",
        "is_image_url_id_checked",
        "image_id_urls",
        "auto_buy_enabled",
        "random_reload_min",
        "random_reload_max",
        "hard_reload_minutes",
        "ignore_1m_tag",
        "monitoring_session_token"
    ], (data) => {
        if (!data.monitoring_active) {
            return;
        }

        const navigationType = getNavigationType();
        if (navigationType !== "reload") {
            logInfo("restoreMonitoringState skipped: non-reload navigation", { navigationType });
            filterActive = false;
            clearPendingReload();
            return;
        }

        const storedOrigin = data.monitoring_origin || window.location.origin;
        if (storedOrigin !== window.location.origin) {
            logInfo("restoreMonitoringState skipped: different origin", { storedOrigin, currentOrigin: window.location.origin });
            return;
        }

        const storedSessionToken = typeof data.monitoring_session_token === "string"
            ? data.monitoring_session_token
            : null;
        const localSessionToken = sessionStorage.getItem(MONITORING_SESSION_KEY);
        if (!storedSessionToken || !localSessionToken || storedSessionToken !== localSessionToken) {
            logInfo("restoreMonitoringState skipped: tab session mismatch", {
                hasStoredToken: Boolean(storedSessionToken),
                hasLocalToken: Boolean(localSessionToken)
            });
            filterActive = false;
            clearPendingReload();
            return;
        }

        monitoringOrigin = storedOrigin;
        filterActive = true;
        discountRanges = Array.isArray(data.discount_ranges) && data.discount_ranges.length > 0
            ? data.discount_ranges
            : discountRanges;
        is_image_url_checked = Boolean(data.is_image_url_checked);
        image_url_filter_type = data.image_url_filter_type || image_url_filter_type;
        image_urls = {};
        (data.image_urls || []).forEach((url) => {
            const parts = url.split(";");
            if (parts.length > 1) {
                image_urls[parts[0]] = parts.slice(1);
            } else {
                image_urls[url] = [];
            }
        });
        is_image_url_id_checked = Boolean(data.is_image_url_id_checked);
        image_id_urls = data.image_id_urls || [];
        autoBuyEnabled = Boolean(data.auto_buy_enabled);
        ignore1mTag = data.ignore_1m_tag !== undefined ? Boolean(data.ignore_1m_tag) : true;

        if (typeof data.random_reload_min === "number") {
            randomReloadMin = Math.max(0, data.random_reload_min);
        }
        if (typeof data.random_reload_max === "number") {
            randomReloadMax = Math.max(randomReloadMin, data.random_reload_max);
        }

        if (typeof data.hard_reload_minutes === "number" && data.hard_reload_minutes >= 0) {
            hardReloadIntervalMs = data.hard_reload_minutes * 60 * 1000;
        }

        clicksRemainingThisCycle = 5;
        lastHardReload = Date.now();
        filterProducts();
        scheduleNextReload();
        logInfo("Monitoring restored after reload");
    });
}

async function handleCartOverflowIfNeeded() {
    const counter = document.querySelector("[data-popper-placement='top-end'] div:last-child");
    if (!counter) {
        return;
    }
    const count = parseInt(counter.textContent.trim(), 10);
    if (Number.isNaN(count) || count < 10) {
        return;
    }
    logInfo("Cart overflow detected", { count });

    const supportBtn = await waitForElement("#support-widget-parent button[type='button']", 2000);
    if (!supportBtn) {
        logError("Support button not found during overflow handling");
        return;
    }
    await safeClick(supportBtn);

    const cartButtons = Array.from(document.querySelectorAll(".enter-done div[aria-label='Add item to cart']"));
    logInfo("Clearing cart items via overflow handler", { buttons: cartButtons.length });
    for (const btn of cartButtons) {
        await safeClick(btn);
    }
}

async function runPurchaseFlow(attempt = 1) {
    if (!autoBuyEnabled) {
        return;
    }
    if (!addedThisCycle && !cartHasItems()) {
        return;
    }
    if (cartFlowInProgress) {
        return;
    }
    const MAX_ATTEMPTS = 3;
    cartFlowInProgress = true;
    logInfo("Purchase flow start", { attempt, addedThisCycle, cartHasItems: cartHasItems() });

    try {
        const supportBtn = await waitForElement("#support-widget-parent button[type='button']", 4000);
        if (!supportBtn) {
            logError("Support button not found during purchase flow");
            cartFlowInProgress = false;
            return;
        }
        await safeClick(supportBtn);

        await delay(150);

        const confirmBtn = await waitForConfirmButton(7000);
        if (confirmBtn) {
            await safeClick(confirmBtn.element);
            logInfo("Confirm button clicked", { selector: confirmBtn.selector });
        } else {
            logError("Confirm button not found during purchase flow");
        }

        const outcome = await waitForAnyDeep([
            "button[data-testid='items-not-available-action'][type='button']",
            "[data-testid='buy-success-step']",
            "div[data-testid='buy-success-step']"
        ], 10000);

        if (!outcome) {
            logError("Outcome not found (success or not-available)");
            cartFlowInProgress = false;
            return;
        }

        if (outcome.selector === "button[data-testid='items-not-available-action'][type='button']") {
            await safeClick(outcome.element);
            cartFlowInProgress = false;
            if (attempt < MAX_ATTEMPTS) {
                setTimeout(() => runPurchaseFlow(attempt + 1), 800);
            }
            logInfo("Items not available, retrying", { nextAttempt: attempt + 1 });
            return;
        }

        const portalBtn = document.querySelector("[data-scroll-locked='1'] .portal [tabindex='0'] svg[role='button']");
        if (portalBtn) {
            const portalClickTarget = portalBtn.closest("[tabindex], button, [role='button']") || portalBtn;
            await safeClick(portalClickTarget);
            logInfo("Purchase success, closing portal");
        }
    } finally {
        cartFlowInProgress = false;
        logInfo("Purchase flow end");
    }
}

function querySelectorDeep(selector, root = document) {
    const stack = [root];
    while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node.querySelector !== "function") {
            continue;
        }
        const found = node.querySelector(selector);
        if (found) {
            return found;
        }
        const children = node.querySelectorAll("*");
        children.forEach((child) => {
            if (child.shadowRoot) {
                stack.push(child.shadowRoot);
            }
        });
    }
    return null;
}

async function waitForConfirmButton(timeoutMs = 6000) {
    const selectors = [
        ".enter-done button[type='button']",
        ".enter-active button[type='button']",
        ".portal button[type='button']",
        "button[data-testid='buy-items-button']",
        "button[data-testid='checkout-button']"
    ];
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        for (const selector of selectors) {
            const el = querySelectorDeep(selector);
            if (el) {
                return { element: el, selector };
            }
        }
        await delay(100);
    }
    logError("Confirm button wait timeout", { timeoutMs, selectors });
    return null;
}

function waitForElement(selector, timeoutMs = 3000) {
    return new Promise((resolve) => {
        const found = document.querySelector(selector);
        if (found) {
            resolve(found);
            return;
        }

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            logError("waitForElement timeout", { selector, timeoutMs });
            resolve(null);
        }, timeoutMs);
    });
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function cartHasItems() {
    const counter = document.querySelector("[data-popper-placement='top-end'] div:last-child");
    if (!counter) {
        return false;
    }
    const count = parseInt(counter.textContent.trim(), 10);
    return !Number.isNaN(count) && count >= 1;
}

function waitForAny(selectors, timeoutMs = 3000) {
    return new Promise((resolve) => {
        for (const sel of selectors) {
            const found = document.querySelector(sel);
            if (found) {
                logInfo("waitForAny immediate hit", { selector: sel });
                resolve({ element: found, selector: sel });
                return;
            }
        }

        const observer = new MutationObserver(() => {
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) {
                    observer.disconnect();
                    logInfo("waitForAny observed", { selector: sel });
                    resolve({ element: el, selector: sel });
                    return;
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            logError("waitForAny timeout", { selectors, timeoutMs });
            resolve(null);
        }, timeoutMs);
    });
}

function waitForAnyDeep(selectors, timeoutMs = 3000, pollIntervalMs = 100) {
    return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
            for (const sel of selectors) {
                const el = querySelectorDeep(sel);
                if (el) {
                    logInfo("waitForAnyDeep hit", { selector: sel });
                    resolve({ element: el, selector: sel });
                    return;
                }
            }
            if (Date.now() - start >= timeoutMs) {
                logError("waitForAnyDeep timeout", { selectors, timeoutMs });
                resolve(null);
                return;
            }
            setTimeout(check, pollIntervalMs);
        };
        check();
    });
}

function safeClick(el, delayMs = 200) {
    return new Promise((resolve) => {
        if (!el) {
            logError("safeClick called with null element");
            resolve(false);
            return;
        }
        setTimeout(() => {
            if (typeof el.click === "function") {
                el.click();
            } else {
                const evt = new MouseEvent("click", { bubbles: true, cancelable: true });
                el.dispatchEvent(evt);
            }
            logInfo("safeClick", { tag: el.tagName, classes: el.className, delayMs });
            resolve(true);
        }, delayMs);
    });
}

const observer = new MutationObserver((mutations) => {
    console.log("Mutation observed");
    filterProducts();
});

const config = { childList: true, subtree: true };
observer.observe(document.body, config);