console.log("Hello from content.js");

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
        image_urls_string = message.image_urls;
        image_urls = {};
        image_urls_string.forEach((url) => {
            elements = url.split(';');
            if (elements.length > 1) {
                image_urls[elements[0]] = elements.slice(1)
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
        tryReload();
        scheduleNextReload();
    }, delay);
}

function tryReload() {
    clicksRemainingThisCycle = 5;
    addedThisCycle = false;
    const reloadButton = document.querySelector("[aria-label='Refresh results']");
    if (reloadButton) {
        reloadButton.click();
    }
    setTimeout(runPurchaseFlow, 500);
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
                    addButton.click();
                    recordPurchase(productId);
                    clicksRemainingThisCycle -= 1;
                    addedThisCycle = true;
                    setTimeout(runPurchaseFlow, 500);
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

async function runPurchaseFlow(attempt = 1) {
    if (!addedThisCycle) {
        return;
    }
    if (cartFlowInProgress) {
        return;
    }
    const MAX_ATTEMPTS = 3;
    cartFlowInProgress = true;

    try {
        const supportBtn = await waitForElement("#support-widget-parent button[type='button']", 4000);
        if (!supportBtn) {
            cartFlowInProgress = false;
            return;
        }
        supportBtn.click();

        const confirmBtn = await waitForElement(".enter-done button[type='button']", 4000);
        if (confirmBtn) {
            confirmBtn.click();
        }

        const portalBtn = await waitForElement(".portal svg[role='button']", 5000);
        if (!portalBtn) {
            cartFlowInProgress = false;
            return;
        }

        const notAvailableBtn = document.querySelector("button[data-testid='items-not-available-action'][type='button']");
        if (notAvailableBtn) {
            notAvailableBtn.click();
            cartFlowInProgress = false;
            if (attempt < MAX_ATTEMPTS) {
                setTimeout(() => runPurchaseFlow(attempt + 1), 800);
            }
            return;
        }

        portalBtn.click();
    } finally {
        cartFlowInProgress = false;
    }
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
            resolve(null);
        }, timeoutMs);
    });
}

const observer = new MutationObserver((mutations) => {
    console.log("Mutation observed");
    filterProducts();
});

const config = { childList: true, subtree: true };
observer.observe(document.body, config);