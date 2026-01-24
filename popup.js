const minRangeInput = document.getElementById("min-range");
const maxRangeInput = document.getElementById("max-range");
const delayInput = document.getElementById("delay");
const highlightColorInput = document.getElementById("highlight-color");

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

// get data from storage
chrome.storage.local.get(["min", "max", "delay", "highlight_color", "is_image_url_checked", "image_url_filter_type", "image_urls", "is_image_url_id_checked", "image_id_urls"], (data) => {
    if (data.min !== undefined) minRangeInput.value = data.min;
    if (data.max !== undefined) maxRangeInput.value = data.max;
    if (data.delay !== undefined) delayInput.value = data.delay;
    if (data.highlight_color !== undefined) highlightColorInput.value = data.highlight_color;

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
applyButton.addEventListener("click", () => {
    const min = parseInt(minRangeInput.value, 10);
    const max = parseInt(maxRangeInput.value, 10);

    const delay = parseInt(delayInput.value, 10);
    const highlight_color = highlightColorInput.value;

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

    if (min <= max) {
        chrome.storage.local.set({ min, max, delay, highlight_color, is_image_url_checked, image_url_filter_type, image_urls, is_image_url_id_checked, image_id_urls });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "applyFilter",
                min,
                max,
                delay,
                highlight_color,
                is_image_url_checked,
                image_url_filter_type,
                image_urls,
                is_image_url_id_checked,
                image_id_urls
            });
        });
    } else {
        alert("Min range should be less or equal to max range");
    }
});

  