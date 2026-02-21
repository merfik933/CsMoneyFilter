console.log("Hello from content.js");

let discountRanges = [{ min: 0, max: 100, color: "#1e365c", buy: false }];

let is_image_url_checked = false;
let image_url_filter_type = "blacklist";
let image_urls = {};

let is_image_url_id_checked = false;
let image_id_urls = {};

let timeDelay = 700;
let filterActive = false;

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
        filterActive = true;
        discountRanges = Array.isArray(message.discount_ranges) && message.discount_ranges.length > 0
            ? message.discount_ranges
            : discountRanges;
        timeDelay = message.delay;

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

        filterProducts();
    }
});

function filterProducts() {
    if (!filterActive) {
        return;
    }
    
    let products = getProductCards();
    
    products.forEach((product) => {
        let shouldHighlight = false;
        
        // Перевіряємо фільтри
        // 1. Фільтр по знижкам (діапазони)
        let matchedRangeColor = null;
        const discount = getDiscountValue(product);
        for (const range of discountRanges) {
            if (discount >= range.min && discount <= range.max) {
                matchedRangeColor = range.color;
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
        setTimeout(() => {
            const bgElement = findBackgroundElement(product);
            if (bgElement) {
                if (shouldHighlight) {
                    bgElement.style.backgroundColor = matchedRangeColor;
                } else {
                    bgElement.style.backgroundColor = "";
                }
            }
        }, timeDelay);

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

const observer = new MutationObserver((mutations) => {
    console.log("Mutation observed");
    filterProducts();
});

const config = { childList: true, subtree: true };
observer.observe(document.body, config);