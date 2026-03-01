const discountRangesContainer = document.getElementById("discount-ranges");
const addDiscountRangeButton = document.getElementById("add-discount-range");
const autoBuyCheckbox = document.getElementById("auto-buy");
const randomReloadMinInput = document.getElementById("random-reload-min");
const randomReloadMaxInput = document.getElementById("random-reload-max");
const clearPurchaseHistoryButton = document.getElementById("clear-purchase-history");

const addNew = document.querySelector(".add-new");
const addNew_id = document.querySelector(".add-new-id");

const uploadImageUrlsCsv = document.getElementById("upload-image-urls");
const deleteAllImageUrls = document.getElementById("delete-all-image-urls");

const uploadImageUrlsCsv_id = document.getElementById("upload-image-urls-id");
const deleteAllImageUrls_id = document.getElementById("delete-all-image-urls-id");

deleteAllImageUrls.addEventListener("click", () => {
    const imageList = document.querySelector(".dropdown-content");
    const items = imageList.querySelectorAll(".list-item");
    items.forEach((item) => {
        if (!item.classList.contains("add-new")) {
            item.remove();
        }
    });
});

deleteAllImageUrls_id.addEventListener("click", () => {
    const imageList = document.querySelector(".dropdown-id-content");
    const items = imageList.querySelectorAll(".list-item-id");
    items.forEach((item) => {
        if (!item.classList.contains("add-new-id")) {
            item.remove();
        }
    });
});

uploadImageUrlsCsv.addEventListener("change", (event) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const csv = e.target.result;
        const lines = csv.split("\n");
        const imageList = document.querySelector(".dropdown-content");
        lines.forEach((line) => {
            const newItemElement = document.createElement("div");
            newItemElement.className = "list-item";
            
            const deleteButton = document.createElement("div");
            deleteButton.className = "delete-button";
            const deleteIcon = document.createElement("span");
            deleteIcon.className = "material-symbols-outlined";
            deleteIcon.textContent = "delete";
            deleteButton.appendChild(deleteIcon);
            deleteButton.addEventListener("click", () => {
                newItemElement.remove();
            });

            const text = document.createElement("p");
            text.textContent = line;

            newItemElement.appendChild(deleteButton);
            newItemElement.appendChild(text);
            imageList.appendChild(newItemElement);
        });
    };
    reader.readAsText(event.target.files[0]);
});

uploadImageUrlsCsv_id.addEventListener("change", (event) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const csv = e.target.result;
        const lines = csv.split("\n");
        const imageList = document.querySelector(".dropdown-id-content");
        lines.forEach((line) => {
            const newItemElement = document.createElement("div");
            newItemElement.className = "list-item-id";
            
            const deleteButton = document.createElement("div");
            deleteButton.className = "delete-button";
            const deleteIcon = document.createElement("span");
            deleteIcon.className = "material-symbols-outlined";
            deleteIcon.textContent = "delete";
            deleteButton.appendChild(deleteIcon);
            deleteButton.addEventListener("click", () => {
                newItemElement.remove();
            });

            const text = document.createElement("p");
            text.textContent = line;

            newItemElement.appendChild(deleteButton);
            newItemElement.appendChild(text);
            imageList.appendChild(newItemElement);
        });
    };
    reader.readAsText(event.target.files[0]);
});

addNew.addEventListener("click", () => {
    const newItem = prompt("Enter new item:");
    if (newItem) {
        const newItemElement = document.createElement("div");
        newItemElement.className = "list-item";
        
        const deleteButton = document.createElement("div");
        deleteButton.className = "delete-button";
        const deleteIcon = document.createElement("span");
        deleteIcon.className = "material-symbols-outlined";
        deleteIcon.textContent = "delete";
        deleteButton.appendChild(deleteIcon);
        deleteButton.addEventListener("click", () => {
            newItemElement.remove();
        });

        const text = document.createElement("p");
        text.textContent = newItem;
        
        newItemElement.appendChild(deleteButton);
        newItemElement.appendChild(text);
        addNew.parentNode.insertBefore(newItemElement, addNew.nextSibling);
    }
});

addNew_id.addEventListener("click", () => {
    const newItem = prompt("Enter new item:");
    if (newItem) {
        const newItemElement = document.createElement("div");
        newItemElement.className = "list-item-id";
        
        const deleteButton = document.createElement("div");
        deleteButton.className = "delete-button";
        const deleteIcon = document.createElement("span");
        deleteIcon.className = "material-symbols-outlined";
        deleteIcon.textContent = "delete";
        deleteButton.appendChild(deleteIcon);
        deleteButton.addEventListener("click", () => {
            newItemElement.remove();
        });

        const text = document.createElement("p");
        text.textContent = newItem;
        
        newItemElement.appendChild(deleteButton);
        newItemElement.appendChild(text);
        addNew_id.parentNode.insertBefore(newItemElement, addNew_id.nextSibling);
    }
});

const DEFAULT_RANGE = { min: 0, max: 100, color: "#1e365c", buy: false };

function updateBuyCheckboxState() {
    if (!autoBuyCheckbox) {
        return;
    }
    const isEnabled = autoBuyCheckbox.checked;
    discountRangesContainer.querySelectorAll(".range-buy-checkbox").forEach((checkbox) => {
        checkbox.disabled = !isEnabled;
    });
}

function renderDiscountRanges(ranges) {
    discountRangesContainer.innerHTML = "";
    ranges.forEach((range, index) => {
        const buyValue = range.buy !== undefined ? range.buy : DEFAULT_RANGE.buy;
        const row = document.createElement("div");
        row.className = "discount-range";
        row.dataset.index = index;

        const minLabel = document.createElement("label");
        minLabel.textContent = "Мін:";
        const minInput = document.createElement("input");
        minInput.type = "number";
        minInput.min = "0";
        minInput.max = "100";
        minInput.value = range.min;
        minInput.className = "range-min";

        const maxLabel = document.createElement("label");
        maxLabel.textContent = "Макс:";
        const maxInput = document.createElement("input");
        maxInput.type = "number";
        maxInput.min = "0";
        maxInput.max = "100";
        maxInput.value = range.max;
        maxInput.className = "range-max";

        const buyLabel = document.createElement("label");
        buyLabel.textContent = "Buy";
        buyLabel.className = "range-buy";
        const buyInput = document.createElement("input");
        buyInput.type = "checkbox";
        buyInput.checked = buyValue;
        buyInput.className = "range-buy-checkbox";
        buyLabel.appendChild(buyInput);

            const colorInput = document.createElement("input");
            colorInput.type = "color";
            colorInput.value = range.color || DEFAULT_RANGE.color;
            colorInput.className = "range-color"; // Retain the color input

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "range-remove";
            removeButton.textContent = "✕"; // Change to cross
        removeButton.disabled = ranges.length === 1;
        removeButton.addEventListener("click", () => {
            if (ranges.length === 1) {
                return;
            }
            ranges.splice(index, 1);
            renderDiscountRanges(ranges);
        });

        row.appendChild(minLabel);
        row.appendChild(minInput);
        row.appendChild(maxLabel);
        row.appendChild(maxInput);
        row.appendChild(buyLabel);
        row.appendChild(colorInput);
        row.appendChild(removeButton);

        discountRangesContainer.appendChild(row);
    });

    updateBuyCheckboxState();
}

function readDiscountRangesFromUI() {
    const rows = discountRangesContainer.querySelectorAll(".discount-range");
    const ranges = [];
    rows.forEach((row) => {
        const minValue = parseInt(row.querySelector(".range-min").value, 10);
        const maxValue = parseInt(row.querySelector(".range-max").value, 10);
        const colorValue = row.querySelector(".range-color").value || DEFAULT_RANGE.color;
        const buyValue = row.querySelector(".range-buy-checkbox").checked;
        ranges.push({ min: minValue, max: maxValue, color: colorValue, buy: buyValue });
    });
    return ranges;
}

function validateDiscountRanges(ranges) {
    if (!ranges || ranges.length === 0) {
        return "Має бути хоча б один діапазон";
    }

    for (const range of ranges) {
        if (Number.isNaN(range.min) || Number.isNaN(range.max)) {
            return "Мін/Макс мають бути числами";
        }
        if (range.min < 0 || range.max > 100) {
            return "Діапазон має бути між 0 і 100";
        }
        if (range.min > range.max) {
            return "Мін не може бути більшим за Макс";
        }
    }

    const sorted = [...ranges].sort((a, b) => a.min - b.min);
    for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (current.max > next.min) {
            return "Діапазони не можуть перетинатися";
        }
    }

    return null;
}

addDiscountRangeButton.addEventListener("click", () => {
    const currentRanges = readDiscountRangesFromUI();
    currentRanges.push({ ...DEFAULT_RANGE });
    renderDiscountRanges(currentRanges);
});

autoBuyCheckbox.addEventListener("change", () => {
    updateBuyCheckboxState();
});

// get data from storage
chrome.storage.local.get(["discount_ranges", "min", "max", "highlight_color", "is_image_url_checked", "image_url_filter_type", "image_urls", "is_image_url_id_checked", "image_id_urls", "auto_buy_enabled", "random_reload_min", "random_reload_max", "purchase_history"], (data) => {
    if (data.auto_buy_enabled !== undefined) autoBuyCheckbox.checked = data.auto_buy_enabled;
    if (data.random_reload_min !== undefined) randomReloadMinInput.value = data.random_reload_min;
    if (data.random_reload_max !== undefined) randomReloadMaxInput.value = data.random_reload_max;

    // Prune purchase history entries older than 24 hours
    if (data.purchase_history) {
        const now = Date.now();
        const ttl = 24 * 60 * 60 * 1000;
        const cleaned = {};
        Object.entries(data.purchase_history).forEach(([id, ts]) => {
            if (typeof ts === "number" && now - ts < ttl) {
                cleaned[id] = ts;
            }
        });
        if (Object.keys(cleaned).length !== Object.keys(data.purchase_history).length) {
            chrome.storage.local.set({ purchase_history: cleaned });
        }
    }

    let ranges = data.discount_ranges;
    if (!ranges || ranges.length === 0) {
        const fallbackMin = data.min !== undefined ? data.min : DEFAULT_RANGE.min;
        const fallbackMax = data.max !== undefined ? data.max : DEFAULT_RANGE.max;
        const fallbackColor = data.highlight_color || DEFAULT_RANGE.color;
            ranges = [{ min: fallbackMin, max: fallbackMax, color: fallbackColor, buy: DEFAULT_RANGE.buy }];
    }
    renderDiscountRanges(ranges);
    updateBuyCheckboxState();

    if (data.is_image_url_checked !== undefined) document.getElementById("image-filter-checkbox").checked = data.is_image_url_checked;
    if (data.image_url_filter_type !== undefined) document.getElementById("image-filter-type").value = data.image_url_filter_type;
    if (data.image_urls !== undefined) {
        const imageList = document.querySelector(".dropdown-content");
        data.image_urls.forEach((url) => {
            const newItemElement = document.createElement("div");
            newItemElement.className = "list-item";
            
            const deleteButton = document.createElement("div");
            deleteButton.className = "delete-button";
            const deleteIcon = document.createElement("span");
            deleteIcon.className = "material-symbols-outlined";
            deleteIcon.textContent = "delete";
            deleteButton.appendChild(deleteIcon);
            deleteButton.addEventListener("click", () => {
                newItemElement.remove();
            });

            const text = document.createElement("p");
            text.textContent = url;

            newItemElement.appendChild(deleteButton);
            newItemElement.appendChild(text);
            imageList.appendChild(newItemElement);
        });
    }

    if (data.is_image_url_id_checked !== undefined) document.getElementById("image-id-filter-checkbox").checked = data.is_image_url_id_checked;
    if (data.image_id_urls !== undefined) {
        const imageList = document.querySelector(".dropdown-id-content");
        data.image_id_urls.forEach((url) => {
            const newItemElement = document.createElement("div");
            newItemElement.className = "list-item-id";
            
            const deleteButton = document.createElement("div");
            deleteButton.className = "delete-button";
            const deleteIcon = document.createElement("span");
            deleteIcon.className = "material-symbols-outlined";
            deleteIcon.textContent = "delete";
            deleteButton.appendChild(deleteIcon);
            deleteButton.addEventListener("click", () => {
                newItemElement.remove();
            });

            const text = document.createElement("p");
            text.textContent = url;

            newItemElement.appendChild(deleteButton);
            newItemElement.appendChild(text);
            imageList.appendChild(newItemElement);
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateIDList") {
        let image_id_urls = request.id;
        const imageList = document.querySelector(".dropdown-id-content");
        const items = imageList.querySelectorAll(".list-item-id");
        items.forEach((item) => {
            if (!item.classList.contains("add-new-id")) {
                item.remove();
            }
        });
        image_id_urls.forEach((url) => {
            const newItemElement = document.createElement("div");
            newItemElement.className = "list-item-id";
            
            const deleteButton = document.createElement("div");
            deleteButton.className = "delete-button";
            const deleteIcon = document.createElement("span");
            deleteIcon.className = "material-symbols-outlined";
            deleteIcon.textContent = "delete";
            deleteButton.appendChild(deleteIcon);
            deleteButton.addEventListener("click", () => {
                newItemElement.remove();
            });

            const text = document.createElement("p");
            text.textContent = url;

            newItemElement.appendChild(deleteButton);
            newItemElement.appendChild(text);
            imageList.appendChild(newItemElement);
        });
    }
});

// apply button
const applyButton = document.getElementById("apply-filter");
let monitoringActive = false;

function updateMonitoringButtonUI() {
    applyButton.textContent = monitoringActive ? "Закінчити моніторинг" : "Розпочати моніторинг";
    applyButton.classList.toggle("monitoring-active", monitoringActive);
}

function syncMonitoringStateFromPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0]) {
            monitoringActive = false;
            updateMonitoringButtonUI();
            return;
        }

        chrome.tabs.sendMessage(tabs[0].id, { action: "getMonitoringState" }, (response) => {
            if (chrome.runtime.lastError) {
                monitoringActive = false;
            } else {
                monitoringActive = Boolean(response && response.monitoringActive);
            }
            updateMonitoringButtonUI();
        });
    });
}

updateMonitoringButtonUI();
syncMonitoringStateFromPage();

applyButton.addEventListener("click", () => {
    const discount_ranges = readDiscountRangesFromUI();
    const rangesError = validateDiscountRanges(discount_ranges);
    if (rangesError) {
        alert(rangesError);
        return;
    }

    const is_image_url_checked = document.getElementById("image-filter-checkbox").checked;
    const image_url_filter_type = document.getElementById("image-filter-type").value;
    const image_url_list = document.querySelectorAll(".list-item p");
    let image_urls = [];
    image_url_list.forEach((element) => {
        image_urls.push(element.textContent);
    });

    const is_image_url_id_checked = document.getElementById("image-id-filter-checkbox").checked;
    const image_id_url_list = document.querySelectorAll(".list-item-id p");
    let image_id_urls = [];
    image_id_url_list.forEach((element) => {
        image_id_urls.push(element.textContent);
    });

    const auto_buy_enabled = autoBuyCheckbox.checked;

    const random_reload_min = Math.max(0, parseInt(randomReloadMinInput.value, 10) || 0);
    const random_reload_max = Math.max(random_reload_min, parseInt(randomReloadMaxInput.value, 10) || random_reload_min);

    const nextMonitoringState = !monitoringActive;
    monitoringActive = nextMonitoringState;
    updateMonitoringButtonUI();

    chrome.storage.local.set({ discount_ranges, is_image_url_checked, image_url_filter_type, image_urls, is_image_url_id_checked, image_id_urls, auto_buy_enabled, random_reload_min, random_reload_max });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
            action: "applyFilter",
            discount_ranges,
            is_image_url_checked,
            image_url_filter_type,
            image_urls,
            is_image_url_id_checked,
            image_id_urls,
            auto_buy_enabled,
            monitoringActive: monitoringActive,
            random_reload_min,
            random_reload_max
        });
    });
});

clearPurchaseHistoryButton.addEventListener("click", () => {
    chrome.storage.local.set({ purchase_history: {} });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "clearPurchaseHistory" });
        }
    });
});

  