# Shipping Label Manager

A local web app that consolidates orders from TCGPlayer and eBay, generates USPS shipping labels via ShipAway.io, and exports tracking CSVs for upload back to your selling platforms.

## Features

- **TCGPlayer CSV Import** — Drop your TCGPlayer shipping export CSV, orders are parsed and grouped automatically
- **eBay CSV Import** — Drop your eBay Seller Hub order export CSV
- **Label Queue** — Select orders from any source, review them, and generate USPS Priority labels in bulk
- **Per-Order Package Overrides** — Set default package dimensions in Settings, override on individual orders as needed
- **Print Labels** — View and print the actual USPS label PDFs from ShipAway
- **Export Tracking CSV** — Download a CSV with order numbers, tracking numbers, and carrier in the format TCGPlayer expects for bulk upload
- **Sender Address** — Saved in your browser so you only enter it once

## Requirements

- Node.js (v18 or newer)
- A ShipAway.io account with API key and balance

## Setup

1. Open a terminal and navigate to this folder:

```
cd shipping-label-manager
```

2. Install dependencies:

```
npm install
```

3. Open the `.env` file and replace the placeholder with your ShipAway API key and phone number:

```
SHIPAWAY_API_KEY=your-api-key-here
SHIPAWAY_PHONE=your-phone-number
```

You can find your API key on the ShipAway.io developer page after logging in.

4. Start the app:

```
npm run dev
```

5. Open your browser to **http://localhost:5173**

## First Time Setup

When you first open the app, go to the **Settings** tab and enter:

- Your return/sender address (name, street, city, state, zip)
- Default package dimensions and weight

These are saved in your browser and persist across sessions.

## Usage

### Importing Orders

**TCGPlayer:**
1. Export your shipping CSV from TCGPlayer Seller Hub
2. Go to the **TCGPlayer** tab and drag-and-drop the CSV file (or click to browse)
3. Orders are parsed and displayed in a table

**eBay:**
1. Export your orders CSV from eBay Seller Hub (Orders > Download report)
2. Go to the **eBay** tab and drag-and-drop the CSV file
3. Orders are parsed and displayed in a table

### Generating Labels

1. Select orders using the checkboxes, then click **Add to Label Queue**
2. In the **Label Queue** tab, review your orders
3. Click the package size button on any order to override the default dimensions if needed
4. Click **Generate Labels** to create USPS Priority labels via ShipAway ($3.50 each)
5. Labels are generated and tracking numbers appear in the table

### Printing Labels

After generating labels, click **Print Labels** to view the actual USPS label PDFs. Use your browser's print dialog to print them.

### Exporting Tracking for TCGPlayer

After generating labels, click **Export TCG Tracking CSV** to download a CSV file with:

| Order # | Tracking # | Carrier |
|---------|-----------|---------|
| D0D98196-... | 9488... | USPS |

Upload this file to TCGPlayer to bulk-update tracking numbers.

## Costs

Each label uses your ShipAway.io balance. Current pricing:

| Service | Price |
|---------|-------|
| USPS Priority (9488 Series) | $3.50 |

Check https://shipaway.io/api/v1/usps/list for the latest rates.

## Troubleshooting

- **"SHIPAWAY_API_KEY not set"** — Make sure your `.env` file exists and has your API key
- **Labels fail to generate** — The app authenticates with ShipAway using a session cookie. If labels fail, restart the server (`Ctrl+C` then `npm run dev`)
- **Port already in use** — Kill any existing processes on ports 3001 or 5173, or change them in `server/index.js` and `vite.config.js`
