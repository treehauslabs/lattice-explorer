let baseUrl = "http://127.0.0.1:8545";
let pollTimer = null;
let chainHeight = 0;
let browseIndex = 0;

// --- API ---

async function api(path, options) {
    const res = await fetch(baseUrl + path, options);
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `HTTP ${res.status}`);
    }
    return res.json();
}

function getChainInfo() {
    return api("/api/chain/info");
}

function getBalance(address) {
    return api("/api/balance/" + encodeURIComponent(address));
}

function getBlock(id) {
    return api("/api/block/" + encodeURIComponent(id));
}

function getReceipt(txCID) {
    return api("/api/receipt/" + encodeURIComponent(txCID));
}

function postTransaction(tx) {
    return api("/api/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tx),
    });
}

// --- DOM helpers ---

function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }
function setText(id, val) { document.getElementById(id).textContent = val ?? "—"; }
function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + "\u2026" : s; }

function renderKV(containerId, pairs) {
    const grid = document.getElementById(containerId);
    grid.innerHTML = "";
    for (const [key, value, opts] of pairs) {
        const row = document.createElement("div");
        row.className = "kv-row";

        const k = document.createElement("span");
        k.className = "kv-key";
        k.textContent = key;

        const v = document.createElement("span");
        v.className = "kv-val" + (opts?.mono ? " mono" : "");

        if (opts?.clickable && value) {
            const link = document.createElement("span");
            link.className = "clickable-hash";
            link.textContent = opts.truncate ? truncate(value, opts.truncate) : value;
            link.title = value;
            link.onclick = opts.clickable;
            v.appendChild(link);
        } else {
            v.textContent = value ?? "—";
        }

        row.appendChild(k);
        row.appendChild(v);
        grid.appendChild(row);
    }
}

// --- Tabs ---

document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(t => t.classList.add("hidden"));
        btn.classList.add("active");
        show("tab-" + btn.dataset.tab);
    });
});

// --- Connect ---

async function connect() {
    baseUrl = document.getElementById("endpoint").value.replace(/\/+$/, "");
    if (pollTimer) clearInterval(pollTimer);

    try {
        await refreshChainInfo();
        hide("disconnected");
        show("tabs");
        show("tab-chain");
        document.getElementById("connectBtn").textContent = "Connected";
        pollTimer = setInterval(refreshChainInfo, 5000);
    } catch (e) {
        show("disconnected");
        document.getElementById("disconnected").textContent =
            "Connection failed: " + e.message;
    }
}

// --- Chain Info ---

async function refreshChainInfo() {
    const info = await getChainInfo();

    chainHeight = info.height ?? info.chainHeight ?? 0;
    setText("chainHeight", chainHeight.toLocaleString());
    setText("chainTip", truncate(info.tip ?? info.chainTip ?? "", 48));
    setText("genesis", truncate(info.genesis ?? info.genesisHash ?? "", 48));
    setText("peers", info.peers ?? info.peerCount ?? "—");

    const details = [];
    const skip = new Set(["height", "chainHeight", "tip", "chainTip",
        "genesis", "genesisHash", "peers", "peerCount"]);
    for (const [key, val] of Object.entries(info)) {
        if (skip.has(key)) continue;
        if (val === null || val === undefined) continue;
        const display = typeof val === "object" ? JSON.stringify(val) : String(val);
        details.push([key, display, { mono: typeof val === "string" && val.length > 20 }]);
    }
    if (details.length > 0) {
        renderKV("chainDetailsGrid", details);
        show("chainDetails");
    } else {
        hide("chainDetails");
    }

    if (browseIndex === 0 && chainHeight > 0) {
        browseIndex = chainHeight;
    }
}

// --- Blocks ---

async function lookupBlock() {
    const id = document.getElementById("blockIdInput").value.trim();
    if (!id) return;
    try {
        const block = await getBlock(id);
        displayBlock(block);
    } catch (e) {
        hide("blockResult");
        alert("Block not found: " + e.message);
    }
}

function displayBlock(block) {
    const pairs = [];
    const txs = [];

    for (const [key, val] of Object.entries(block)) {
        if (key === "transactions" || key === "txs") {
            if (Array.isArray(val)) txs.push(...val);
            continue;
        }
        const isHash = typeof val === "string" && val.length >= 40;
        const display = typeof val === "object" ? JSON.stringify(val) : String(val ?? "—");
        const opts = { mono: isHash, truncate: isHash ? 48 : 0 };

        if (isHash && key.toLowerCase().includes("block")) {
            opts.clickable = () => {
                document.getElementById("blockIdInput").value = val;
                lookupBlock();
            };
        } else if (isHash && (key.toLowerCase().includes("tx") || key.toLowerCase().includes("cid"))) {
            opts.clickable = () => {
                switchToTab("transactions");
                document.getElementById("txCidInput").value = val;
                lookupReceipt();
            };
        }

        pairs.push([key, display, opts]);
    }

    renderKV("blockDetailGrid", pairs);
    show("blockResult");

    const txItemsEl = document.getElementById("blockTxItems");
    txItemsEl.innerHTML = "";
    if (txs.length > 0) {
        for (const tx of txs) {
            const cid = typeof tx === "string" ? tx : (tx.cid ?? tx.hash ?? tx.id ?? JSON.stringify(tx));
            const row = document.createElement("div");
            row.className = "tx-row";
            const link = document.createElement("span");
            link.className = "clickable-hash";
            link.textContent = truncate(cid, 64);
            link.title = cid;
            link.onclick = () => {
                switchToTab("transactions");
                document.getElementById("txCidInput").value = cid;
                lookupReceipt();
            };
            row.appendChild(link);

            if (typeof tx === "object") {
                if (tx.from || tx.to) {
                    const meta = document.createElement("span");
                    meta.className = "tx-meta";
                    meta.textContent = [tx.from && `from ${truncate(tx.from, 16)}`, tx.to && `to ${truncate(tx.to, 16)}`].filter(Boolean).join(" ");
                    row.appendChild(meta);
                }
                if (tx.amount !== undefined || tx.value !== undefined) {
                    const amt = document.createElement("span");
                    amt.className = "tx-amount";
                    amt.textContent = (tx.amount ?? tx.value).toLocaleString();
                    row.appendChild(amt);
                }
            }

            txItemsEl.appendChild(row);
        }
        show("blockTxList");
    } else {
        hide("blockTxList");
    }
}

async function browseBlock(direction) {
    switch (direction) {
        case "first": browseIndex = 0; break;
        case "prev": if (browseIndex > 0) browseIndex--; break;
        case "next": if (browseIndex < chainHeight) browseIndex++; break;
        case "latest": browseIndex = chainHeight; break;
    }
    document.getElementById("browseLabel").textContent =
        `Block ${browseIndex.toLocaleString()} of ${chainHeight.toLocaleString()}`;
    try {
        const block = await getBlock(String(browseIndex));
        displayBlock(block);
    } catch {
        hide("blockResult");
    }
}

// --- Balances ---

async function lookupBalance() {
    const address = document.getElementById("addressInput").value.trim();
    if (!address) return;
    try {
        const result = await getBalance(address);
        setText("balAddress", address);
        setText("balAmount", (result.balance ?? result.amount ?? "—").toLocaleString());
        setText("balNonce", result.nonce ?? "—");
        show("balanceResult");
    } catch (e) {
        hide("balanceResult");
        alert("Balance lookup failed: " + e.message);
    }
}

// --- Transactions ---

async function lookupReceipt() {
    const cid = document.getElementById("txCidInput").value.trim();
    if (!cid) return;
    try {
        const receipt = await getReceipt(cid);
        const pairs = [];
        for (const [key, val] of Object.entries(receipt)) {
            const isHash = typeof val === "string" && val.length >= 40;
            const display = typeof val === "object" ? JSON.stringify(val) : String(val ?? "—");
            const opts = { mono: isHash, truncate: isHash ? 48 : 0 };

            if (isHash && key.toLowerCase().includes("block")) {
                opts.clickable = () => {
                    switchToTab("blocks");
                    document.getElementById("blockIdInput").value = val;
                    lookupBlock();
                };
            }

            pairs.push([key, display, opts]);
        }
        renderKV("receiptGrid", pairs);
        show("receiptResult");
    } catch (e) {
        hide("receiptResult");
        alert("Receipt not found: " + e.message);
    }
}

async function sendTransaction() {
    const banner = document.getElementById("txResultBanner");
    banner.className = "hidden";

    const tx = {
        from: document.getElementById("txFrom").value.trim(),
        to: document.getElementById("txTo").value.trim(),
        amount: document.getElementById("txAmount").value.trim(),
        fee: document.getElementById("txFee").value.trim(),
        nonce: document.getElementById("txNonce").value.trim(),
        data: document.getElementById("txData").value.trim() || undefined,
        privateKey: document.getElementById("txPrivKey").value.trim(),
    };

    if (!tx.from || !tx.to || !tx.privateKey) {
        banner.className = "banner banner-warn";
        banner.textContent = "From, To, and Private Key are required.";
        return;
    }

    try {
        const result = await postTransaction(tx);
        const cid = result.cid ?? result.txCID ?? result.hash ?? JSON.stringify(result);
        banner.className = "banner banner-ok";
        banner.innerHTML = "";
        banner.appendChild(document.createTextNode("Sent! CID: "));
        const link = document.createElement("span");
        link.className = "clickable-hash";
        link.textContent = truncate(cid, 48);
        link.title = cid;
        link.onclick = () => {
            document.getElementById("txCidInput").value = cid;
            lookupReceipt();
        };
        banner.appendChild(link);
    } catch (e) {
        banner.className = "banner banner-warn";
        banner.textContent = "Failed: " + e.message;
    }
}

// --- Tab switching ---

function switchToTab(name) {
    document.querySelectorAll(".tab").forEach(t => {
        t.classList.toggle("active", t.dataset.tab === name);
    });
    document.querySelectorAll(".tab-content").forEach(t => t.classList.add("hidden"));
    show("tab-" + name);
}
