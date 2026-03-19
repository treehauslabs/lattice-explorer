let endpoint = "http://127.0.0.1:8545";
let pollTimer = null;
let currentChainId = null;
let currentBrowseIndex = 0;
let currentChainHeight = 0;

async function rpc(method, params) {
    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method, params: params || [], id: 1 }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
}

function chainRpc(method, params) {
    const p = currentChainId ? [currentChainId, ...(params || [])] : (params || []);
    return rpc(method, p);
}

function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }
function set(id, val) { document.getElementById(id).textContent = val; }
function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + "..." : s; }

function makeClickableHash(hash, onclick) {
    const span = document.createElement("span");
    span.className = "clickable-hash";
    span.textContent = truncate(hash, 48);
    span.title = hash;
    span.onclick = onclick;
    return span;
}

function makeClickableChain(chainId, label) {
    const span = document.createElement("span");
    span.className = "clickable-hash";
    span.textContent = label || truncate(chainId, 32);
    span.title = chainId;
    span.onclick = () => switchChain(chainId, label);
    return span;
}

async function connect() {
    endpoint = document.getElementById("endpoint").value.replace(/\/+$/, "");
    if (pollTimer) clearInterval(pollTimer);
    currentChainId = null;

    try {
        await refresh();
        hide("disconnected");
        show("chainNav");
        show("overview");
        show("nodeSection");
        show("chainSpecSection");
        show("latticeTreeSection");
        show("mempoolSection");
        show("latestBlockSection");
        show("blockBrowser");
        show("blockLookup");
        show("keygen");
        show("rpcConsole");
        document.getElementById("connectBtn").textContent = "Connected";
        pollTimer = setInterval(refresh, 5000);
    } catch (e) {
        show("disconnected");
        document.getElementById("disconnected").textContent =
            "Connection failed: " + e.message;
    }
}

async function switchChain(chainId, label) {
    currentChainId = chainId;
    currentBrowseIndex = 0;
    updateBreadcrumb();
    document.getElementById("currentChainLabel").textContent =
        chainId ? (label || truncate(chainId, 32)) : "Nexus Chain";
    await refresh();
}

function updateBreadcrumb() {
    const bc = document.getElementById("chainBreadcrumb");
    bc.innerHTML = "";

    const nexus = document.createElement("span");
    nexus.className = "breadcrumb-item" + (currentChainId === null ? " active" : "");
    nexus.textContent = "Nexus";
    nexus.onclick = () => switchChain(null);
    bc.appendChild(nexus);

    if (currentChainId) {
        const sep = document.createElement("span");
        sep.className = "breadcrumb-sep";
        sep.textContent = " / ";
        bc.appendChild(sep);

        const child = document.createElement("span");
        child.className = "breadcrumb-item active";
        child.textContent = truncate(currentChainId, 24);
        child.title = currentChainId;
        bc.appendChild(child);
    }
}

async function refresh() {
    const [nodeInfo, chainSpec, mempool, latestBlock] = await Promise.all([
        chainRpc("lattice_nodeInfo"),
        chainRpc("lattice_chainSpec"),
        chainRpc("lattice_getMempoolInfo").catch(() => null),
        chainRpc("lattice_getLatestBlock").catch(() => null),
    ]);

    currentChainHeight = nodeInfo.chainHeight;
    set("chainHeight", nodeInfo.chainHeight.toLocaleString());
    set("chainTip", truncate(nodeInfo.chainTip, 48));
    set("genesisHash", truncate(nodeInfo.genesisHash, 48));
    set("peerCount", nodeInfo.peerCount);

    set("publicKey", truncate(nodeInfo.publicKey, 48));
    set("nodeAddress", nodeInfo.address);
    set("listenPort", nodeInfo.listenPort);

    set("specDirectory", chainSpec.directory);
    set("specBlockTime", chainSpec.targetBlockTime + " ms");
    set("specMaxTxns", chainSpec.maxTransactionsPerBlock.toLocaleString());
    set("specStateGrowth", chainSpec.maxStateGrowth.toLocaleString());
    set("specRewardExp", chainSpec.initialRewardExponent);
    set("specHalving", chainSpec.halvingInterval.toLocaleString());
    set("specReward", chainSpec.initialReward.toLocaleString());

    if (mempool) {
        set("mempoolCount", mempool.count.toLocaleString());
        set("mempoolFees", mempool.totalFees.toLocaleString());
    }

    if (latestBlock) {
        const hashEl = document.getElementById("latestBlockHash");
        hashEl.innerHTML = "";
        hashEl.appendChild(makeClickableHash(latestBlock.hash, () => {
            document.getElementById("blockHashInput").value = latestBlock.hash;
            lookupBlock();
        }));

        set("latestBlockIndex", latestBlock.index.toLocaleString());

        const prevEl = document.getElementById("latestBlockPrev");
        prevEl.innerHTML = "";
        if (latestBlock.previousBlockHash) {
            prevEl.appendChild(makeClickableHash(latestBlock.previousBlockHash, () => {
                document.getElementById("blockHashInput").value = latestBlock.previousBlockHash;
                lookupBlock();
            }));
        } else {
            prevEl.textContent = "Genesis";
        }

        set("latestBlockChildren", latestBlock.childBlockHashes.length > 0 ? latestBlock.childBlockHashes.length.toString() : "None");

        if (currentBrowseIndex === 0) {
            currentBrowseIndex = latestBlock.index;
        }
    }

    refreshLatticeTree();
    refreshBlockBrowser();
}

async function refreshLatticeTree() {
    const container = document.getElementById("latticeTree");
    try {
        const chains = await rpc("lattice_getChildChains", currentChainId ? [currentChainId] : []);
        if (!chains || chains.length === 0) {
            container.innerHTML = '<span class="subtle">No child chains found.</span>';
            return;
        }
        container.innerHTML = "";
        for (const chain of chains) {
            const row = document.createElement("div");
            row.className = "chain-tree-item";

            const icon = document.createElement("span");
            icon.className = "chain-icon";
            icon.textContent = chain.childCount > 0 ? "+" : "-";

            const link = makeClickableChain(chain.chainId, chain.label || chain.chainId);

            const meta = document.createElement("span");
            meta.className = "chain-meta";
            meta.textContent = `Height: ${chain.height} | Children: ${chain.childCount || 0}`;

            row.appendChild(icon);
            row.appendChild(link);
            row.appendChild(meta);
            container.appendChild(row);
        }
    } catch {
        container.innerHTML = '<span class="subtle">Child chain discovery not available.</span>';
    }
}

async function refreshBlockBrowser() {
    if (currentChainHeight === 0) return;
    set("browseBlockNum", currentBrowseIndex.toLocaleString());
    set("browseBlockTotal", currentChainHeight.toLocaleString());

    try {
        const block = await chainRpc("lattice_getBlockByIndex", [currentBrowseIndex]);
        renderBlockDetail(block, "browse");
    } catch {
        set("browseHash", "—");
        set("browseIndex", "—");
        set("browsePrev", "—");
        set("browseMainChain", "—");
        set("browseChildren", "—");
    }
}

function renderBlockDetail(block, prefix) {
    const hashEl = document.getElementById(prefix + "Hash");
    hashEl.innerHTML = "";
    hashEl.appendChild(makeClickableHash(block.hash, () => {
        document.getElementById("blockHashInput").value = block.hash;
        lookupBlock();
    }));

    set(prefix + "Index", block.index.toLocaleString());

    const prevEl = document.getElementById(prefix + "Prev");
    prevEl.innerHTML = "";
    if (block.previousBlockHash) {
        prevEl.appendChild(makeClickableHash(block.previousBlockHash, () => {
            document.getElementById("blockHashInput").value = block.previousBlockHash;
            lookupBlock();
        }));
    } else {
        prevEl.textContent = "Genesis";
    }

    if (document.getElementById(prefix + "MainChain")) {
        set(prefix + "MainChain", block.onMainChain ? "Yes" : "No");
    }

    const childrenEl = document.getElementById(prefix + "Children");
    childrenEl.innerHTML = "";
    if (block.childBlockHashes && block.childBlockHashes.length > 0) {
        block.childBlockHashes.forEach((h, i) => {
            if (i > 0) childrenEl.appendChild(document.createTextNode(", "));
            childrenEl.appendChild(makeClickableHash(h, () => {
                document.getElementById("blockHashInput").value = h;
                lookupBlock();
            }));
        });
    } else {
        childrenEl.textContent = "None";
    }

    const childChainsEl = document.getElementById(prefix + "ChildChains");
    if (childChainsEl && block.childChainIds && block.childChainIds.length > 0) {
        const row = document.getElementById(prefix + "ChildChainsRow");
        if (row) row.classList.remove("hidden");
        childChainsEl.innerHTML = "";
        block.childChainIds.forEach((id, i) => {
            if (i > 0) childChainsEl.appendChild(document.createTextNode(", "));
            childChainsEl.appendChild(makeClickableChain(id));
        });
    } else {
        const row = document.getElementById(prefix + "ChildChainsRow");
        if (row) row.classList.add("hidden");
    }
}

async function browseBlock(direction) {
    switch (direction) {
        case "first":
            currentBrowseIndex = 0;
            break;
        case "prev":
            if (currentBrowseIndex > 0) currentBrowseIndex--;
            break;
        case "next":
            if (currentBrowseIndex < currentChainHeight) currentBrowseIndex++;
            break;
        case "latest":
            currentBrowseIndex = currentChainHeight;
            break;
    }
    await refreshBlockBrowser();
}

async function generateKey() {
    try {
        const result = await rpc("lattice_generateKeyPair");
        set("genPubKey", result.publicKey);
        set("genPrivKey", result.privateKey);
        set("genAddress", result.address);
        show("keyResult");
    } catch (e) {
        alert("Key generation failed: " + e.message);
    }
}

async function lookupBlock() {
    const hash = document.getElementById("blockHashInput").value.trim();
    if (!hash) return;
    try {
        const result = await rpc("lattice_getBlock", [hash]);

        const hashEl = document.getElementById("lookupHash");
        hashEl.innerHTML = "";
        hashEl.appendChild(makeClickableHash(result.hash, () => {
            document.getElementById("blockHashInput").value = result.hash;
            lookupBlock();
        }));

        set("lookupIndex", result.index.toLocaleString());

        const prevEl = document.getElementById("lookupPrev");
        prevEl.innerHTML = "";
        if (result.previousBlockHash) {
            prevEl.appendChild(makeClickableHash(result.previousBlockHash, () => {
                document.getElementById("blockHashInput").value = result.previousBlockHash;
                lookupBlock();
            }));
        } else {
            prevEl.textContent = "Genesis";
        }

        set("lookupMainChain", result.onMainChain ? "Yes" : "No");

        const childrenEl = document.getElementById("lookupChildren");
        childrenEl.innerHTML = "";
        if (result.childBlockHashes && result.childBlockHashes.length > 0) {
            result.childBlockHashes.forEach((h, i) => {
                if (i > 0) childrenEl.appendChild(document.createTextNode(", "));
                childrenEl.appendChild(makeClickableHash(h, () => {
                    document.getElementById("blockHashInput").value = h;
                    lookupBlock();
                }));
            });
        } else {
            childrenEl.textContent = "None";
        }

        show("blockLookupResult");
    } catch (e) {
        hide("blockLookupResult");
        alert("Block not found: " + e.message);
    }
}

async function sendRpc() {
    const method = document.getElementById("methodSelect").value;
    const output = document.getElementById("rpcOutput");
    output.textContent = "Loading...";
    try {
        const result = await chainRpc(method);
        output.textContent = JSON.stringify(result, null, 2);
    } catch (e) {
        output.textContent = "Error: " + e.message;
    }
}
