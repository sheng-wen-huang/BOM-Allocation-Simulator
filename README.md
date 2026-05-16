# BOM Allocation Simulator

Client-side React application for simulating warehouse BOM available stock on hand using the PRD waterfall allocation rules.

## Run locally

```bash
npm install
npm run dev
```

## Validate

```bash
npm test
npm run build
```

## CSV inputs

`BOM_Structure.csv`

```csv
ParentSKU,ComponentSKU,QtyPerBOM,UDF01,UDF03
KIT-A,COMP-1,2,,900
KIT-A,COMP-2,1,,900
KIT-C,COMP-2,2,X,8
```

`Inventory.csv`

```csv
SKU,Qty
COMP-1,100
COMP-2,30
```

The app includes sample download buttons for both files.
