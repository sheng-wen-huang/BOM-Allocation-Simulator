const EPSILON = 1e-9;

function validPriority(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1000 ? value : 0;
}

function aggregateInventory(inventoryRows) {
  const inventory = new Map();
  inventoryRows.forEach((row) => {
    inventory.set(row.sku, (inventory.get(row.sku) || 0) + row.qty);
  });
  return inventory;
}

function getInventory(inventory, sku) {
  return inventory.get(sku) || 0;
}

function normalizeBomGroups(bomRows) {
  const groups = new Map();

  bomRows.forEach((row) => {
    if (!groups.has(row.parentSku)) {
      groups.set(row.parentSku, {
        parentSku: row.parentSku,
        isFixed: false,
        reservationRequest: 0,
        priorityScore: 0,
        components: new Map(),
      });
    }

    const group = groups.get(row.parentSku);
    const rowIsFixed = row.udf01?.trim().toUpperCase() === 'X';
    if (rowIsFixed) {
      group.isFixed = true;
      group.reservationRequest = validPriority(row.udf03);
      group.priorityScore = group.reservationRequest;
    } else if (!group.isFixed) {
      group.priorityScore = validPriority(row.udf03);
    }

    const currentQty = group.components.get(row.componentSku) || 0;
    group.components.set(row.componentSku, currentQty + row.qtyPerBom);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      mode: group.isFixed ? 'X' : group.priorityScore > 0 ? 'Waterfall' : 'Zero',
      components: Array.from(group.components.entries())
        .map(([componentSku, qtyPerBom]) => ({ componentSku, qtyPerBom }))
        .sort((a, b) => a.componentSku.localeCompare(b.componentSku)),
    }))
    .sort((a, b) => a.parentSku.localeCompare(b.parentSku));
}

function theoreticalMax(group, inventory) {
  if (group.components.length === 0) return 0;
  return Math.min(
    ...group.components.map((component) => {
      const available = getInventory(inventory, component.componentSku);
      return Math.floor((available + EPSILON) / component.qtyPerBom);
    }),
  );
}

function findBottleneck(componentDetails) {
  return [...componentDetails].sort((a, b) => {
    if (a.yield !== b.yield) return a.yield - b.yield;
    return a.componentSku.localeCompare(b.componentSku);
  })[0]?.componentSku || '';
}

export function calculateAllocation(bomRows, inventoryRows) {
  const fullInventory = aggregateInventory(inventoryRows);
  const inventoryPool = new Map(fullInventory);
  const groups = normalizeBomGroups(bomRows);
  const results = [];
  const detailByParent = {};

  const fixedGroups = groups
    .filter((group) => group.isFixed)
    .sort((a, b) => {
      if (a.reservationRequest !== b.reservationRequest) return b.reservationRequest - a.reservationRequest;
      return a.parentSku.localeCompare(b.parentSku);
    });
  fixedGroups.forEach((group) => {
    const inventoryBeforeReservation = new Map(inventoryPool);
    const max = theoreticalMax(group, inventoryBeforeReservation);
    const actualReservation = Math.min(group.reservationRequest, max);

    group.components.forEach((component) => {
      const beforeDeduction = getInventory(inventoryPool, component.componentSku);
      const consumed = component.qtyPerBom * actualReservation;
      inventoryPool.set(component.componentSku, Math.max(0, beforeDeduction - consumed));
    });

    detailByParent[group.parentSku] = {
      mode: 'X',
      requested: group.reservationRequest,
      theoreticalMaximum: max,
      actualReservation,
      capped: group.reservationRequest > actualReservation,
      components: group.components.map((component) => ({
        ...component,
        inventoryAvailable: getInventory(inventoryBeforeReservation, component.componentSku),
        consumed: component.qtyPerBom * actualReservation,
      })),
    };

    results.push({
      parentSku: group.parentSku,
      priorityScore: group.priorityScore,
      availSoh: actualReservation,
      mode: 'X',
      bottleneck: findBottleneck(
        group.components.map((component) => ({
          componentSku: component.componentSku,
          yield: Math.floor(getInventory(inventoryBeforeReservation, component.componentSku) / component.qtyPerBom),
        })),
      ),
    });
  });

  const waterfallGroups = groups.filter((group) => !group.isFixed && group.priorityScore > 0);
  const tiers = [...new Set(waterfallGroups.map((group) => group.priorityScore))].sort((a, b) => b - a);

  tiers.forEach((priorityScore) => {
    const tierGroups = waterfallGroups
      .filter((group) => group.priorityScore === priorityScore)
      .sort((a, b) => a.parentSku.localeCompare(b.parentSku));
    const demandByComponent = new Map();

    tierGroups.forEach((group) => {
      group.components.forEach((component) => {
        demandByComponent.set(
          component.componentSku,
          (demandByComponent.get(component.componentSku) || 0) + component.qtyPerBom,
        );
      });
    });

    const tierDetails = new Map();
    tierGroups.forEach((group) => {
      const componentDetails = group.components.map((component) => {
        const inventoryAvailable = getInventory(inventoryPool, component.componentSku);
        const totalTierDemand = demandByComponent.get(component.componentSku) || 0;
        const rawAllocated =
          totalTierDemand > 0 ? inventoryAvailable * (component.qtyPerBom / totalTierDemand) : 0;
        const allocatedQty = Math.floor(rawAllocated + EPSILON);
        const yieldQty = Math.floor((allocatedQty + EPSILON) / component.qtyPerBom);

        return {
          ...component,
          inventoryAvailable,
          totalTierDemand,
          allocatedQty,
          yield: yieldQty,
        };
      });

      const availSoh = componentDetails.length
        ? Math.min(...componentDetails.map((detail) => detail.yield))
        : 0;
      tierDetails.set(group.parentSku, { group, componentDetails, availSoh });
    });

    tierDetails.forEach(({ group, componentDetails, availSoh }) => {
      group.components.forEach((component) => {
        const beforeDeduction = getInventory(inventoryPool, component.componentSku);
        const consumed = component.qtyPerBom * availSoh;
        inventoryPool.set(component.componentSku, Math.max(0, beforeDeduction - consumed));
      });

      const bottleneck = findBottleneck(componentDetails);
      detailByParent[group.parentSku] = {
        mode: 'Waterfall',
        priorityScore,
        components: componentDetails,
        bottleneck,
      };
      results.push({
        parentSku: group.parentSku,
        priorityScore,
        availSoh,
        mode: 'Waterfall',
        bottleneck,
      });
    });
  });

  groups
    .filter((group) => !group.isFixed && group.priorityScore <= 0)
    .forEach((group) => {
      detailByParent[group.parentSku] = {
        mode: 'Zero',
        priorityScore: group.priorityScore,
        components: group.components,
      };
      results.push({
        parentSku: group.parentSku,
        priorityScore: group.priorityScore,
        availSoh: 0,
        mode: 'Zero',
        bottleneck: '',
      });
    });

  return {
    results: results.sort((a, b) => a.parentSku.localeCompare(b.parentSku)),
    details: detailByParent,
    remainingInventory: Object.fromEntries(inventoryPool),
  };
}

export function applyScenarioOverrides(bomRows, inventoryRows, overrides) {
  const inventoryQty = overrides?.inventoryQty || {};
  const priority = overrides?.priority || {};
  const fixedMode = overrides?.fixedMode || {};
  const inventoryBySku = aggregateInventory(inventoryRows);

  const adjustedInventoryRows = Array.from(inventoryBySku.entries()).map(([sku, qty]) => ({
    id: `${sku}-scenario`,
    rowNumber: 0,
    sku,
    qty: Object.prototype.hasOwnProperty.call(inventoryQty, sku) ? Number(inventoryQty[sku]) : qty,
    raw: { SKU: sku, Qty: String(qty) },
  }));

  const adjustedBomRows = bomRows.map((row) => {
    const next = { ...row };
    if (Object.prototype.hasOwnProperty.call(priority, row.parentSku)) {
      next.udf03 = Number(priority[row.parentSku]);
    }
    if (Object.prototype.hasOwnProperty.call(fixedMode, row.parentSku)) {
      next.udf01 = fixedMode[row.parentSku] ? 'X' : '';
    }
    return next;
  });

  return { bomRows: adjustedBomRows, inventoryRows: adjustedInventoryRows };
}
