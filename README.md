# BOM Allocation Simulator

Client-side React app for simulating BOM available stock on hand with fixed reservations and waterfall priority allocation.

Live site: https://sheng-wen-huang.github.io/BOM-Allocation-Simulator/

## Features

- Upload and preview full BOM and inventory CSV files.
- Run baseline allocation results in the dashboard.
- Adjust inventory, priority, and `UDF01=X` fixed mode in the What-If Simulator.
- What-If results recalculate automatically after edits.
- Export results back into the BOM template column format.
- Dark mode UI.

## Run Locally

```bash
npm install
npm run dev
```

## Validate

```bash
npm test
npm run build
```

## BOM CSV Template

Required for calculation: `sku`, `componentsku`, `qty`.

Preserved for preview and export: `storerkey`, `sequence`, `bomonly`, `notes`, `parentqty`, `udf02`.

Calculation controls:

- `udf01`: use `X` for fixed reservation mode.
- `udf03`: priority for normal waterfall mode, or requested reservation quantity when `udf01=X`.

```csv
storerkey,sku,componentsku,sequence,bomonly,notes,qty,parentqty,udf01,udf02,udf03
WH1,KIT-A,COMP-1,10,N,,2,1,,,900
WH1,KIT-A,COMP-2,20,N,,1,1,,,900
WH1,KIT-C,COMP-2,10,Y,Fixed reserve,2,1,X,,8
```

Legacy aliases are also accepted for compatibility:

- `ParentSKU` -> `sku`
- `QtyPerBOM` -> `qty`

## Inventory CSV Template

The app accepts either English or warehouse-export column names:

```csv
sku,qty
COMP-1,100
COMP-2,30
```

```csv
產品名稱,E208-EC倉
COMP-1,100
COMP-2,30
```

## What-If Simulator

Inventory adjustments are limited to `0` or greater.

Priority adjustments are limited from `0` to `1000`.

`Reset All` restores the baseline scenario and keeps the comparison table populated with baseline results.

## Export

Exported CSV uses the BOM template columns:

```csv
storerkey,sku,componentsku,sequence,bomonly,notes,qty,parentqty,udf01,udf02,udf03
```

Export values reflect the latest What-If result when one exists. Otherwise, export uses the baseline result.

- `udf01` exports `X` for fixed mode and blank for non-fixed mode.
- `udf03` exports after `AvailSOH` for fixed mode, or priority for non-fixed mode.
