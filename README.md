# BOM Allocation Simulator

Client-side React application for simulating BOM available stock on hand with fixed reservations and waterfall priority allocation.

## Features

- Upload and preview BOM and inventory `.xlsx` files.
- Download `.xlsx` templates for BOM and inventory input.
- Run baseline allocation results in the dashboard.
- Adjust inventory, priority, and `UDF01=X` fixed mode in the What-If Simulator.
- Recalculate What-If results automatically after edits.
- Export results as `.xlsx` using the BOM template column format.
- Process all uploaded data locally in the browser.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by the terminal.

## Validate

```bash
npm audit
npm test
npm run build
```

## Cloudflare Pages

Recommended deployment settings:

```text
Build command: npm ci && npm run build
Build output directory: dist
Root directory: /
Node.js version: 22
```

The project includes `src/public/_headers`, which is copied into `dist/_headers` during build so Cloudflare Pages can apply security headers.

## Upload Limits

- File type: `.xlsx`
- Maximum file size: 10 MB
- Maximum worksheet rows: 10,000
- Maximum worksheet columns: 50
- XLSX files must be valid ZIP containers (`PK` magic bytes)
- ZIP safety checks reject abnormal entry counts, extreme compression ratios, and oversized uncompressed content

## BOM Template

The app reads the first worksheet in the uploaded `.xlsx` file.

Required for calculation: `sku`, `componentsku`, `qty`.

Preserved for preview and export: `storerkey`, `sequence`, `bomonly`, `notes`, `parentqty`, `udf02`.

Validation rules:

- For each `sku`, `sequence` must be unique and contiguous from `1` to `N` (no duplicates, no gaps).
- `bomonly` only accepts `Y` or `N`.

Calculation controls:

- `udf01`: use `X` for fixed reservation mode.
- `udf03`: priority for normal waterfall mode, or requested reservation quantity when `udf01=X`.

`UDF01=X` BOMs reserve inventory first, in `udf03` descending order and then `sku` ascending order. Each fixed BOM receives the actual reservable quantity from the remaining inventory pool before normal waterfall allocation starts.

```text
storerkey,sku,componentsku,sequence,bomonly,notes,qty,parentqty,udf01,udf02,udf03
XYZ,BOM-A,COMP-1,1,Y,,2,1,,,900
XYZ,BOM-A,COMP-2,2,Y,,1,1,,,900
XYZ,BOM-C,COMP-2,1,Y,,2,1,X,,8
```

Accepted BOM column aliases:

- `ParentSKU` -> `sku`
- `QtyPerBOM` -> `qty`

## Inventory Template

The app reads the first worksheet in the uploaded `.xlsx` file.

Accepted inventory column names:

```text
sku,qty
COMP-1,100
COMP-2,30
```

```text
ComponentSKU,qty
COMP-1,100
COMP-2,30
```

```text
產品編號,E208-EC倉
COMP-1,100
COMP-2,30
```

## What-If Simulator

Inventory adjustments are limited to `0` or greater.

Priority adjustments are limited from `0` to `1000`.

`Reset All` restores the baseline scenario and keeps the comparison table populated with baseline results.

Before / After Comparison supports sorting by clicking the table headers (`SKU`, `Priority/ReservedQty`, `Before AvailSOH`, `After AvailSOH`, `Delta`, `Mode`).

## Export

Export downloads an `.xlsx` workbook using the BOM template columns:

```text
Storerkey,Sku,ComponentSku,Sequence,BomOnly,Notes,Qty,ParentQty,UDF01,UDF02,UDF03
```

Export values reflect the selected result set.

- `udf01` exports `X` for fixed mode and blank for non-fixed mode.
- `udf03` always exports `Priority/ReservedQty` from the What-If or baseline result.
- Export row ordering follows the current What-If comparison sorting order.
- Export preview uses padded monospace alignment so `|` separators stay aligned.
