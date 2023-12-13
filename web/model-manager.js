import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { ComfyDialog, $el } from "../../scripts/ui.js";

function debounce(func, delay) {
    let timer;
    return function () {
        clearTimeout(timer);
        timer = setTimeout(() => {
            func.apply(this, arguments);
        }, delay);
    };
}

class Tabs {
    /** @type {Record<string, HTMLDivElement>} */
    #head = {};
    /** @type {Record<string, HTMLDivElement>} */
    #body = {};

    /**
     * @param {Array<HTMLDivElement>} tabs
     */
    constructor(tabs) {
        const head = [];
        const body = [];

        tabs.forEach((el, index) => {
            const name = el.getAttribute("data-name");

            /** @type {HTMLDivElement} */
            const tag = $el(
                "div.head-item",
                { onclick: () => this.active(name) },
                [name]
            );

            if (index === 0) {
                this.#active = name;
            }

            this.#head[name] = tag;
            head.push(tag);
            this.#body[name] = el;
            body.push(el);
        });

        this.element = $el("div.comfy-tabs", [
            $el("div.comfy-tabs-head", head),
            $el("div.comfy-tabs-body", body),
        ]);

        this.active(this.#active);
    }

    #active = undefined;

    active(name) {
        this.#active = name;
        Object.keys(this.#head).forEach((key) => {
            if (name === key) {
                this.#head[key].classList.add("active");
                this.#body[key].style.display = "";
            } else {
                this.#head[key].classList.remove("active");
                this.#body[key].style.display = "none";
            }
        });
    }
}

/**
 * @param {Record<string, any>} option
 * @param {Array<HTMLDivElement>} tabs
 */
function $tabs(tabs) {
    const instance = new Tabs(tabs);
    return instance.element;
}

/**
 * @param {string} name
 * @param {Array<HTMLDivElement>} el
 * @returns {HTMLDivElement}
 */
function $tab(name, el) {
    return $el("div", { dataset: { name } }, el);
}

class List {
    /**
     * @typedef Column
     * @prop {string} title
     * @prop {string} dataIndex
     * @prop {number} width
     * @prop {string} align
     * @prop {Function} render
     */

    /** @type {Array<Column>} */
    #columns = [];

    /** @type {Array<Record<string, any>>} */
    #dataSource = [];

    /** @type {HTMLDivElement} */
    #tbody = null;

    /**
     * @param {Array<Column>} columns
     */
    constructor(columns) {
        this.#columns = columns;

        const colgroup = $el(
            "colgroup",
            columns.map((item) => {
                return $el("col", {
                    style: { width: `${item.width}px` },
                });
            })
        );

        const listTitle = $el(
            "tr",
            columns.map((item) => {
                return $el("th", [item.title ?? ""]);
            })
        );

        this.element = $el("table.comfy-table", [
            colgroup.cloneNode(true),
            $el("thead.table-head", [listTitle]),
            $el("tbody.table-body", { $: (el) => (this.#tbody = el) }),
        ]);
    }

    setData(dataSource) {
        this.#dataSource = dataSource;
        this.#updateList();
    }

    getData() {
        return this.#dataSource;
    }

    #updateList() {
        this.#tbody.innerHTML = null;
        this.#tbody.append.apply(
            this.#tbody,
            this.#dataSource.map((row, index) => {
                const cells = this.#columns.map((item) => {
                    const dataIndex = item.dataIndex;
                    const cellValue = row[dataIndex] ?? "";
                    const content = item.render
                        ? item.render(cellValue, row, index)
                        : cellValue ?? "-";

                    const style = { textAlign: item.align };
                    return $el("td", { style }, [content]);
                });
                return $el("tr", cells);
            })
        );
    }
}

class Grid {
    constructor() {
        this.element = $el("div.comfy-grid");
    }

    #dataSource = [];

    setData(dataSource) {
        this.#dataSource = dataSource;
        this.element.innerHTML = [];
        this.#updateList();
    }

    #updateList() {
        this.element.innerHTML = null;
        if (this.#dataSource.length > 0) {
            this.element.append.apply(
                this.element,
                this.#dataSource.map((item) => {
                    const uri = item.post ?? "no-post";
                    const imgUrl = `/model-manager/imgPreview?uri=${uri}`;
                    return $el("div.item", {}, [
                        $el("img", { src: imgUrl }),
                        $el("p", [item.name]),
                    ]);
                })
            );
        } else {
            this.element.innerHTML = "<h2>No Models</h2>";
        }
    }
}

function $radioGroup(attr) {
    const { name = Date.now(), onchange, options = [], $ } = attr;

    /** @type {HTMLDivElement[]} */
    const radioGroup = options.map((item, index) => {
        const inputRef = { value: null };

        return $el(
            "div.comfy-radio",
            { onclick: () => inputRef.value.click() },
            [
                $el("input.radio-input", {
                    type: "radio",
                    name: name,
                    value: item.value,
                    checked: index === 0,
                    $: (el) => (inputRef.value = el),
                }),
                $el("label", [item.label ?? item.value]),
            ]
        );
    });

    const element = $el("input", { value: options[0]?.value });
    $?.(element);

    radioGroup.forEach((radio) => {
        radio.addEventListener("change", (event) => {
            const selectedValue = event.target.value;
            element.value = selectedValue;
            onchange?.(selectedValue);
        });
    });

    return $el("div.comfy-radio-group", radioGroup);
}

class ModelManager extends ComfyDialog {
    #request(url, options) {
        return new Promise((resolve, reject) => {
            api.fetchApi(url, options)
                .then((response) => response.json())
                .then(resolve)
                .catch(reject);
        });
    }

    #el = {
        loadSourceBtn: null,
        loadSourceFromSelect: null,
        loadSourceFromInput: null,
        sourceInstalledFilter: null,
        sourceContentFilter: null,
        sourceFilterBtn: null,
        modelTypeSelect: null,
    };

    #data = {
        sourceList: [],
        models: {},
    };

    /** @type {List} */
    #sourceList = null;

    constructor() {
        super();
        this.element = $el(
            "div.comfy-modal.model-manager",
            { parent: document.body },
            [
                $el("div.comfy-modal-content", [
                    $el("button.close", {
                        textContent: "X",
                        onclick: () => this.close(),
                    }),
                    $tabs([
                        $tab("Source Install", this.#createSourceInstall()),
                        $tab("Customer Install", []),
                        $tab("Model List", this.#createModelList()),
                        $tab("Fetched Models", []),
                        // 列下载模型，路径，名字，大小， refersh，权限问题？
                    ]),
                ]),
            ]
        );

        this.#init();
    }

    #init() {
        this.#refreshSourceList();
        this.#refreshModelList();
        const downloadedModelsTab = this.element.querySelector('[data-name="Fetched Models"]');
        if (downloadedModelsTab) {
            const downloadedModelContent = this.#createDownloadedModelTab();
            
            downloadedModelsTab.appendChild(downloadedModelContent);
        }
    }

    #createSourceInstall() {
        this.#createSourceList();
        const createInputField = (placeholder) => {
            return $el('div.row', [
                $el('input', { 
                    placeholder: placeholder, 
                    style: { flex: 1 }
                })
            ]);
        };
        const createInputFieldWtHint = (data) => {
            return $el('div.row', [
                $el('input', { 
                    placeholder: data.placeholder, 
                    style: { flex: 1 },
                    value: data.value
                })
            ]);
        };
        const nameInput = createInputField('Name');
        const pathInput = createInputFieldWtHint({'placeholder':'Download Path', 'value':'custom_nodes'});
        const downloadInput = createInputField('Download URL');

        // Button to trigger the download
        const downloadButton = $el('button', {
            type: 'button',
            textContent: 'Fetch Model',
            style: { 'font-size': '15px' ,'height': '50%'},
            onclick: () => this.#downloadModel({
                // type: typeInput.children[0].value,
                // base: baseInput.children[0].value,
                // page: pageInput.children[0].value,
                download: downloadInput.children[0].value,
                // name: downloadInput.children[0].value.split("/").pop(),
                name: nameInput.children[0].value,
                path: pathInput.children[0].value,
                description: 'custom model',
            })
        });
        return [
            $el("div.row", [
                $el("button", {
                    type: "button",
                    textContent: "Load From",
                    $: (el) => (this.#el.loadSourceBtn = el),
                    onclick: () => this.#refreshSourceList(),
                }),
                $el(
                    "select",
                    {
                        $: (el) => (this.#el.loadSourceFromSelect = el),
                        onchange: (e) => {
                            const val = e.target.val;
                            this.#el.loadSourceFromInput.disabled =
                                val === "Local Source";
                        },
                    },
                    [
                        $el("option", ["Local Source"]),
                        $el("option", ["Web Source"]),
                    ]
                ),
                $el("input", {
                    $: (el) => (this.#el.loadSourceFromInput = el),
                    value: "https://github.com/hayden-fr/ComfyUI-Model-Manager/blob/main/index.json",
                    style: { flex: 1 },
                    disabled: true,
                }),
                $el("div", { style: { width: "50px" } }),
                $el(
                    "select",
                    {
                        $: (el) => (this.#el.sourceInstalledFilter = el),
                        onchange: () => this.#filterSourceList(),
                    },
                    [
                        $el("option", ["Filter: All"]),
                        $el("option", ["Installed"]),
                        $el("option", ["Non-Installed"]),
                    ]
                ),
                $el("input", {
                    $: (el) => (this.#el.sourceContentFilter = el),
                    placeholder: "Input search keyword",
                    onkeyup: (e) =>
                        e.code === "Enter" && this.#filterSourceList(),
                }),
                $el("button", {
                    type: "button",
                    textContent: "Search",
                    onclick: () => this.#filterSourceList(),
                }),
                
            ]),
            $el("div.row", [
            // typeInput,
            // baseInput,
            nameInput,
            pathInput,
            downloadInput,
            downloadButton]),
            
            this.#sourceList.element,
        ];
    }

    // Custom Download function
    #downloadModel(modelData) {
        if (!modelData.download) {
            alert('Please enter a download URL.');
            return;
        }
        if (!modelData.path) {
            alert('Please enter a download path.');
            return;
        }
        if (!modelData.name) {
            alert('Please enter a model name.');
            return;
        }

        const payload = {"url":modelData.download, 
                    "directory":modelData.path, 
                    "filename":modelData.name}
        // Send a request to the server to download the model
        alert('Sending request to download model. Please wait a few minutes.')
        fetch('http://localhost:3000/download', {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })
        .then(response => response.text())
        .then(data => alert(data))
        .catch(error => console.error('Error:', error));
    }
        // console.log(modelData);
        // // Trigger the download
        // this.#request('/model-manager/download', {
        //     method: 'POST',
        //     body: JSON.stringify(modelData)
        // })
        // .then(response => {
        //     if (response.success) {
        //         alert('Model downloaded successfully.');
        //     } else {
        //         console.log(response);
        //         alert('Failed to download the model.');
        //     }
        // })
        // .catch(error => {
        //     console.error('Error downloading model:', error);
        //     alert('Error occurred while downloading the model.');
        // });

    // Method to make API call and fetch file content
    // CSV Parser
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',');
        return lines.slice(1).map(line => {
            const data = line.split(',');
            return headers.reduce((obj, nextKey, index) => {
                obj[nextKey] = data[index];
                return obj;
            }, {});
        });
    }

    // Create table from CSV data
createTableFromCSVData(csvData) {
        if (!csvData.length) {
            return $el('div', {textContent: 'No data available'});
        }

        // Extract column names from the first record
        const columns = Object.keys(csvData[0]);
        const table = $el('table', {className: 'comfy-table csv-table'}); // Added 'csv-table' class
        const thead = $el('thead');
        const tbody = $el('tbody');

        // Create table header
        const headerRow = $el('tr');
        columns.forEach(column => {
            headerRow.appendChild($el('th', {textContent: column, className: 'csv-table-cell'})); // Added 'csv-table-cell' class
        });
        thead.appendChild(headerRow);

        // Create table body
        csvData.forEach(row => {
            const bodyRow = $el('tr');
            columns.forEach(column => {
                bodyRow.appendChild($el('td', {textContent: row[column] || '-', className: 'csv-table-cell'})); // Added 'csv-table-cell' class
            });
            tbody.appendChild(bodyRow);
        });

        table.appendChild(thead);
        table.appendChild(tbody);

        return table;
    }
    async fetchFileContent() {
        try {
            const response = await fetch('http://localhost:3000/file-content?filename=yourfile.txt');
            const text = await response.text();
            return this.parseCSV(text);
        } catch (error) {
            console.error('Error fetching file content:', error);
            return 'Failed to load content';
        }
    }
    #createDownloadedModelTab() {
        const contentContainer = $el('div', {});

        // Fetch and display the model list
        const fetchAndDisplayModels = () => {
            this.fetchFileContent().then(content => {
                // Clear existing table before appending new one
                const currentTable = contentContainer.querySelector('.csv-table');
                if (currentTable) {
                    contentContainer.removeChild(currentTable);
                }
    
                const table = this.createTableFromCSVData(content);
                contentContainer.appendChild(table); // Append the table after the button
            }).catch(() => {
                contentContainer.textContent = 'Error loading content';
            });
        };

        // Create a refresh button
        const refreshButton = $el('button', {
            textContent: 'Refresh',
            onclick: fetchAndDisplayModels,
            style: {
                fontSize: '17px', // Smaller font size
                padding: '0px 10px', // Smaller padding
                height: '30px', // Smaller height
                marginBottom: '10px' // Add margin to the bottom
            }
        });
        // Append the refresh button
        contentContainer.appendChild(refreshButton);
        
        // Initially fetch and display models
        fetchAndDisplayModels();

        return contentContainer;
    }
    


    #createSourceList() {
        const sourceList = new List([
            {
                title: "Type",
                dataIndex: "type",
                width: "120",
                align: "center",
            },
            {
                title: "Base",
                dataIndex: "base",
                width: "120",
                align: "center",
            },
            {
                title: "Name",
                dataIndex: "name",
                width: "280",
                render: (value, record) => {
                    const href = record.page;
                    return $el("a", { target: "_blank", href }, [value]);
                },
            },
            {
                title: "Description",
                dataIndex: "description",
            },
            {
                title: "Download",
                width: "150",
                render: (_, record) => {
                    const installed = record.installed;
                    return $el("button.block", {
                        type: "button",
                        disabled: installed,
                        textContent: installed ? "Installed" : "Install",
                        onclick: async (e) => {
                            e.disabled = true;
                            console.log(record);
                            const response = await this.#request(
                                "/model-manager/download",
                                {
                                    method: "POST",
                                    body: JSON.stringify(record),
                                }
                            );
                            console.log(response);
                            e.disabled = false;
                        },
                    });
                },
            },
        ]);
        this.#sourceList = sourceList;
        return sourceList.element;
    }

    async #refreshSourceList() {
        this.#el.loadSourceBtn.disabled = true;
        this.#el.loadSourceFromSelect.disabled = true;

        const sourceType = this.#el.loadSourceFromSelect.value;
        const webSource = this.#el.loadSourceFromInput.value;
        const uri = sourceType === "Local Source" ? "local" : webSource;
        const dataSource = await this.#request(
            `/model-manager/source?uri=${uri}`
        ).catch(() => []);
        this.#data.sourceList = dataSource;
        this.#sourceList.setData(dataSource);
        this.#el.sourceInstalledFilter.value = "Filter: All";
        this.#el.sourceContentFilter.value = "";

        this.#el.loadSourceBtn.disabled = false;
        this.#el.loadSourceFromSelect.disabled = false;
    }

    #filterSourceList() {
        const installedType = this.#el.sourceInstalledFilter.value;
        /** @type {Array<string>} */
        const content = this.#el.sourceContentFilter.value
            .split(" ")
            .map((item) => item.toLowerCase())
            .filter(Boolean);

        const newDataSource = this.#data.sourceList.filter((row) => {
            const filterField = ["type", "name", "base", "description"];
            const rowContent = filterField
                .reduce((memo, field) => memo + " " + row[field], "")
                .toLowerCase();
            return content.reduce((memo, target) => {
                return memo && rowContent.includes(target);
            }, true);
        });

        this.#sourceList.setData(newDataSource);
    }

    /** @type {Grid} */
    #modelList = null;

    #createModelList() {
        const gridInstance = new Grid();
        this.#modelList = gridInstance;

        return [
            $el("div.row", [
                $radioGroup({
                    $: (el) => (this.#el.modelTypeSelect = el),
                    name: "model-type",
                    onchange: () => this.#updateModelList(),
                    options: [
                        { value: "checkpoints" },
                        { value: "clip" },
                        { value: "clip_vision" },
                        { value: "controlnet" },
                        { value: "diffusers" },
                        { value: "embeddings" },
                        { value: "gligen" },
                        { value: "hypernetworks" },
                        { value: "loras" },
                        { value: "style_models" },
                        { value: "unet" },
                        { value: "upscale_models" },
                        { value: "vae" },
                        { value: "vae_approx" },
                    ],
                }),
                $el("button", {
                    type: "button",
                    textContent: "Refresh",
                    style: { marginLeft: "auto" },
                    onclick: () => this.#refreshModelList(),
                }),
            ]),
            gridInstance.element,
        ];
    }

    async #refreshModelList() {
        const dataSource = await this.#request("/model-manager/models");
        this.#data.models = dataSource;
        this.#updateModelList();
    }

    #updateModelList() {
        const type = this.#el.modelTypeSelect.value;
        const list = this.#data.models[type];
        this.#modelList.setData(list);
    }
}

let instance;

/**
 * @returns {ModelManager}
 */
function getInstance() {
    if (!instance) {
        instance = new ModelManager();
    }
    return instance;
}

app.registerExtension({
    name: "Comfy.ModelManager",

    async setup() {
        $el("link", {
            parent: document.head,
            rel: "stylesheet",
            href: "./extensions/ComfyUI-Model-Manager/model-manager.css",
        });

        $el("button", {
            parent: document.querySelector(".comfy-menu"),
            textContent: "Model Manager",
            style: { order: 1 },
            onclick: () => {
                getInstance().show();
            },
        });
    },
});
