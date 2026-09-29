# Bitcoin Portfolio Dashboard (local only)

A privacy-first Bitcoin portfolio dashboard that runs entirely in your browser. Import your wallet's
transaction export (CSV) and see your holdings, true cost basis, fees and profit/loss. Nothing is
uploaded or stored.

![Screenshot](docs/screenshot.png)
<!-- Screenshot placeholder: add docs/screenshot.png taken with Privacy mode ON, using sample-data.csv. -->

## Features

- **CSV import**: drag and drop or pick one or more files. Rows are merged, deduplicated by transaction ID, and summarized (imported / skipped / warnings).
- **Robust parsing**: ISO 8601 timestamps with offsets, `satoshi` and `BTC` units (kept as integer sats internally), optional network fees, Swiss (`5'488.11`), comma (`5,488.11`) and plain number formats, and quoted fields.
- **Currency detection**: the display currency comes from the file's `Historical value currency` (CHF, EUR, USD, …). Mixed currencies are rejected with a clear error.
- **Live price**: fetched from Kraken's public market data in your currency, refreshed every 60 s, with a manual refresh button, a manual price override, and a fully offline mode.
- **KPIs**: BTC held, current value, total paid, profit/loss, effective average buy price, break-even price, fees & spread, network fees.
- **Charts**: portfolio value vs. amount invested over time, BTC price with your buys and your average buy price, cost breakdown, monthly accumulation, buy price distribution.
- **What-if simulator** with quick −50% … +100% scenarios.
- **Stats**: holding period, average/largest purchase, best- and worst-timed buys.
- **Transaction table**: sortable, filterable, and paginated, with per-lot P/L.
- **Privacy mode** blurs every amount, which is useful for screenshots and screen sharing. Addresses and tx IDs are masked by default.
- Dark theme (default) and a light theme.

## Privacy

This app is designed so that your data never leaves your machine:

- CSV files are read and parsed **in the browser, in memory only**. There is no backend.
- **Nothing is persisted**: no `localStorage`, `sessionStorage`, IndexedDB, or cookies (enforced by an ESLint rule). Refreshing the page wipes everything.
- No analytics or telemetry.
- The dev server binds to `127.0.0.1` only.
- A strict **Content-Security-Policy** limits network connections to the app itself and `https://api.kraken.com`.
- Requests are sent with `credentials: 'omit'` and `referrerPolicy: 'no-referrer'`.

### Exactly which network requests are made

Only public Bitcoin market data is requested from Kraken. A request contains only the trading pair
(e.g. `XBTCHF`), a candle interval and, for the live price, a start timestamp. No addresses,
transaction IDs, or amounts are ever sent.

| Purpose | Request |
| --- | --- |
| Current price + rolling 24h change (every 60 s) | `GET https://api.kraken.com/0/public/OHLC?pair=XBT<CUR>&interval=15&since=<now − 24h>` |
| Daily price history for charts (once per session) | `GET https://api.kraken.com/0/public/OHLC?pair=XBT<CUR>&interval=1440` |

Supported currencies are USD, EUR, CHF, GBP, CAD, AUD and JPY. For any other currency, enter a manual
price. Kraken returns about 2 years of daily history, and chart points older than that use prices
implied by your own transactions.

Responses are cached in memory only. Enable **Offline mode** (click the price in the header) to stop
all requests. You can then enter a manual price, and the charts fall back to prices implied by your
own transactions.

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://127.0.0.1:5173
```

Then drop `sample-data.csv` (fake data) onto the page.

Put your real exports in the `private/` folder. It is gitignored, as are all `*.csv` files except
`sample-data.csv`.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server on localhost |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build on localhost |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run check-secrets` | Scan staged files for addresses, tx IDs, and CSVs |

## CSV format

```csv
Time,Type,Amount,Unit,Fee,Fee Unit,Address,Transaction ID,Historical value,Historical value currency,Note
2025-08-11T14:16:20+01:00,received,2659237,satoshi,,,<address>,<txid>,5'488.11,CHF,
```

- `Type`: `received` or `sent`. Rows with other types are skipped with a warning.
- `Amount` / `Fee`: in `satoshi` or `BTC`. `Fee Unit` defaults to `Unit`.
- `Historical value`: the fiat value at the time of the transaction.

## Calculations

| Metric | Formula |
| --- | --- |
| BTC held | Σ received − Σ sent − Σ network fees on sent |
| Historical value of purchases | Σ historical value of received rows |
| Avg buy price (market) | historical value of purchases / BTC received |
| Avg buy price (effective) | total amount paid / BTC held |
| Current value | BTC held × current price |
| Profit/Loss | current value − total amount paid |
| Fees, spread & exchange costs | total amount paid − historical value of purchases |
| Break-even price | total amount paid / BTC held |

All calculation logic is in pure functions in `src/lib/`, with unit tests.

## Contributing / repository hygiene

- A pre-commit hook (`simple-git-hooks`, installed by `npm install`) runs `scripts/check-secrets.mjs`,
  lint, and tests. It blocks commits that contain CSV files (other than `sample-data.csv`), Bitcoin
  addresses, or 64-character hex transaction IDs.
- Test fixtures use obviously fake identifiers. `sample-data.csv` contains only randomly generated values.
- CI (`.github/workflows/ci.yml`) runs the secret scan, lint, tests, and build on every push and pull request.

## License

[MIT](LICENSE)
