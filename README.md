# Lattice Explorer

A web-based block explorer for [Lattice](https://github.com/treehauslabs/lattice) networks. Connects to a [lattice-gateway](https://github.com/treehauslabs/lattice-gateway) JSON-RPC endpoint and provides a visual interface for inspecting chains, blocks, and the lattice tree hierarchy.

## Features

- **Lattice tree navigation** — browse the full chain hierarchy from the nexus down through every child chain
- **Chain switching** — select any chain in the lattice tree and explore its blocks, mempool, and chain spec independently
- **Block browser** — step through blocks by index (first / prev / next / latest) on any chain
- **Block lookup** — search for any block by hash, with clickable hashes for navigation
- **Clickable references** — block hashes, previous block links, child block hashes, and child chain IDs are all interactive
- **Network overview** — chain height, tip, genesis hash, peer count, node info, chain spec
- **Mempool inspector** — pending transaction count and total fees
- **Key generator** — generate keypairs via the gateway
- **RPC console** — send raw JSON-RPC calls to the connected gateway

## Getting Started

### Prerequisites

A running [lattice-gateway](https://github.com/treehauslabs/lattice-gateway) instance. The explorer connects to its JSON-RPC endpoint (default: `http://127.0.0.1:8545`).

### Running

No build step required. Open `index.html` in a browser, enter the gateway URL, and click **Connect**.

```bash
open index.html
```

Or serve it locally:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

## RPC Methods

The explorer uses these JSON-RPC methods from the gateway:

| Method | Parameters | Description |
|--------|-----------|-------------|
| `lattice_nodeInfo` | `[chainId?]` | Node info, chain height, tip, genesis hash |
| `lattice_chainSpec` | `[chainId?]` | Chain configuration (block time, limits, rewards) |
| `lattice_getMempoolInfo` | `[chainId?]` | Pending transaction count and fees |
| `lattice_getLatestBlock` | `[chainId?]` | Latest block on the chain |
| `lattice_getBlock` | `[blockHash]` | Look up a block by hash |
| `lattice_getBlockByIndex` | `[chainId?,] index` | Look up a block by index on a chain |
| `lattice_getChildChains` | `[chainId?]` | List child chains under a given chain |
| `lattice_peerCount` | `[chainId?]` | Number of connected peers |
| `lattice_generateKeyPair` | `[]` | Generate a new keypair |

Methods that accept an optional `chainId` parameter use it to target a specific child chain. When omitted, they operate on the nexus chain.

## Architecture

The explorer is a single-page application with no dependencies:

```
lattice-explorer/
  index.html   — layout and sections
  app.js       — RPC client, chain navigation, block browsing
  style.css    — dark theme styling
```

### Chain Navigation

The explorer maintains a `currentChainId` that scopes all data fetching. When you click a child chain in the lattice tree or breadcrumb, the entire view — overview stats, chain spec, mempool, latest block, block browser — updates to reflect that chain's state. The breadcrumb trail shows your position in the hierarchy.

### Block Browser

Blocks can be navigated in two ways:
1. **By index** — the block browser provides first/prev/next/latest controls using `lattice_getBlockByIndex`
2. **By hash** — the block lookup section and all clickable hash references use `lattice_getBlock`

## Related

- [Lattice](https://github.com/treehauslabs/lattice) — the blockchain framework
- [lattice-gateway](https://github.com/treehauslabs/lattice-gateway) — JSON-RPC gateway server
- [lattice-cli](https://github.com/treehauslabs/lattice-cli) — command-line interface
- [lattice-wallet](https://github.com/treehauslabs/lattice-wallet) — wallet application
- [Lattice Docs](https://treehauslabs.github.io/lattice-docs/) — documentation
