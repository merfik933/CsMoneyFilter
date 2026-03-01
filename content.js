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
let reloadTimeoutId = null;
let purchaseHistory = {};
let clicksRemainingThisCycle = 0;
let cartFlowInProgress = false;
let addedThisCycle = false;
let cycleInProgress = false;

const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;

loadPurchaseHistory();

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
    cycleInProgress = true;
    try {
        await tryReload();
        await handleCartOverflowIfNeeded();
        await delay(500);
        await runPurchaseFlow();
    } finally {
        cycleInProgress = false;
        scheduleNextReload();
    }
}

async function tryReload() {
    clicksRemainingThisCycle = 5;
    addedThisCycle = false;
    const reloadButton = document.querySelector("[aria-label='Refresh results']");
    if (reloadButton) {
        await safeClick(reloadButton).catch((e) => logError("Reload button click failed", e));
    }
    logInfo("Reload triggered");
}

function filterProducts() {
    if (!filterActive) {
        return;
    }
    
    let products = getProductCards();
    
    products.forEach((product) => {
        const productId = getProductId(product);
        let shouldHighlight = false;
        let matchedRange = null;
        
        // Перевіряємо фільтри
        // 1. Фільтр по знижкам (діапазони)
        let matchedRangeColor = null;
        const discount = getDiscountValue(product);
        for (const range of discountRanges) {
            if (discount >= range.min && discount <= range.max) {
                matchedRangeColor = range.color;
                matchedRange = range;
                break;
            }
        }
        shouldHighlight = matchedRangeColor !== null;
        
        // 2. Фільтр по URL зображень + MW
        if (shouldHighlight && is_image_url_checked) {
            const imageElementSrc = getImageSrc(product);
            const mvElements = getMvElements(product);

            if (image_url_filter_type === "blacklist") {
                // Чорний список - виділяємо товари які НЕ в списку
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
                // Білий список - виділяємо тільки товари які В списку
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
        
        // 3. Фільтр по ID - приховуємо товари в чорному списку
        if (shouldHighlight && is_image_url_id_checked) {
            const id = getProductId(product);
            if (id && image_id_urls.includes(id)) {
                shouldHighlight = false;
            }
        }

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

        if (shouldHighlight && matchedRange && matchedRange.buy === true && clicksRemainingThisCycle > 0) {
            if (productId && !isRecentlyPurchased(productId)) {
                const addButton = product.querySelector("[aria-label='Add item to cart']");
                if (addButton) {
                    safeClick(addButton).catch((e) => logError("Add to cart click failed", e));
                    recordPurchase(productId);
                    clicksRemainingThisCycle -= 1;
                    addedThisCycle = true;
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