console.log("Hello from content.js");

let minDiscount = 0;
let maxDiscount = 100;

let is_image_url_checked = false;
let image_url_filter_type = "blacklist";
let image_urls = {};

let is_image_url_id_checked = false;
let image_id_urls = {};

let timeDelay = 700;
let highlightColor = "#FFFF00";
let filterActive = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "applyFilter") {
        filterActive = true;
        minDiscount = message.min;
        maxDiscount = message.max;
        timeDelay = message.delay;
        highlightColor = message.highlight_color;

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
    
    let products = document.querySelectorAll("[data-card-item-id]");
    
    products.forEach((product) => {
        let shouldHighlight = false;
        
        // Перевіряємо фільтри
        // 1. Фільтр по знижкам
        if (!(minDiscount === 0 && maxDiscount === 100)) {
            const discountElement = product.querySelector(".Tag-module_green__5A03j .Tag-module_content__uLsTI");
            if (!discountElement) {
                if (minDiscount > 0) {
                    shouldHighlight = false;
                } else {
                    shouldHighlight = true;
                }
            } else {
                const discount = parseInt(discountElement.innerText.replace("%", "").replace("-", ""));
                if (discount >= minDiscount && discount <= maxDiscount) {
                    shouldHighlight = true;
                } else {
                    shouldHighlight = false;
                }
            }
        } else {
            shouldHighlight = true;
        }
        
        // 2. Фільтр по URL зображень + MW
        if (shouldHighlight && is_image_url_checked) {
            const imageElementSrc = product.querySelector(".csm_3f4a05c6")?.src || product.querySelector(".csm_64196821")?.src;
            const mvElements = product.querySelectorAll("span.csm_ca3cc1f1.csm_ad434a29");

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
            const id = product.getAttribute("data-card-item-id");
            if (image_id_urls.includes(id)) {
                shouldHighlight = false;
            }
        }

        // Застосовуємо виділення
        setTimeout(() => {
            const bgElement = product.querySelector(".csm_06d323e9.csm_157c9c46");
            if (bgElement) {
                if (shouldHighlight) {
                    bgElement.style.backgroundColor = highlightColor;
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
            button.style.color = "white";
            button.style.zIndex = "1000";
            button.style.cursor = "pointer";
            button.addEventListener("click", () => {
                const id = product.getAttribute("data-card-item-id");
                image_id_urls.push(id);
                const bgElement = product.querySelector(".csm_06d323e9.csm_157c9c46");
                if (bgElement) {
                    bgElement.style.backgroundColor = "";
                }
                chrome.runtime.sendMessage({ action: "addImageId", id: image_id_urls });
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