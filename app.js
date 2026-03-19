let endpoint = "http://127.0.0.1:8545";
let pollTimer = null;

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

function show(id) { document.getElementById(id).classList.remove("hidden"); }
function hide(id) { document.getElementById(id).classList.add("hidden"); }
function set(id, val) { document.getElementById(id).textContent = val; }
function truncate(s, n) { return s.length > n ? s.slice(0, n) + "..." : s; }

async function connect() {
    endpoint = document.getElementById("endpoint").value.replace(/\/+$/, "");
    if (pollTimer) clearInterval(pollTimer);

    try {
        await refresh();
        hide("disconnected");
        show("overview");
        show("nodeSection");
        show("chainSpecSection");
        show("mempoolSection");
        show("latestBlockSection");
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

async function refresh() {
    const [nodeInfo, chainSpec, mempool, latestBlock] = await Promise.all([
        rpc("lattice_nodeInfo"),
        rpc("lattice_chainSpec"),
        rpc("lattice_getMempoolInfo").catch(() => null),
        rpc("lattice_getLatestBlock").catch(() => null),
    ]);

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
        set("latestBlockHash", truncate(latestBlock.hash, 48));
        set("latestBlockIndex", latestBlock.index.toLocaleString());
        set("latestBlockPrev", latestBlock.previousBlockHash ? truncate(latestBlock.previousBlockHash, 48) : "Genesis");
        set("latestBlockChildren", latestBlock.childBlockHashes.length > 0 ? latestBlock.childBlockHashes.length.toString() : "None");
    }
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
        set("lookupHash", truncate(result.hash, 48));
        set("lookupIndex", result.index.toLocaleString());
        set("lookupPrev", result.previousBlockHash ? truncate(result.previousBlockHash, 48) : "Genesis");
        set("lookupMainChain", result.onMainChain ? "Yes" : "No");
        set("lookupChildren", result.childBlockHashes.length > 0 ? result.childBlockHashes.length.toString() : "None");
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
        const result = await rpc(method);
        output.textContent = JSON.stringify(result, null, 2);
    } catch (e) {
        output.textContent = "Error: " + e.message;
    }
}
