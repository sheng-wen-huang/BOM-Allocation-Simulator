import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';

const columns = [
  ['parentSku', 'SKU'],
  ['priorityScore', 'Priority'],
  ['availSoh', 'AvailSOH'],
  ['mode', 'Mode'],
  ['bottleneck', 'Bottleneck'],
];

function ModeBadge({ mode }) {
  return <span className={`mode-badge ${mode.toLowerCase()}`}>{mode}</span>;
}

function DetailPanel({ detail }) {
  if (!detail) return null;

  if (detail.mode === 'X') {
    return (
      <div className="detail-panel">
        <p>
          Requested {detail.requested} / Theoretical Maximum {detail.theoreticalMaximum} / Actual Reserve{' '}
          {detail.actualReservation}
        </p>
        {detail.capped && <p className="warning">Requested reservation was capped by available inventory.</p>}
        <table>
          <thead>
            <tr>
              <th>ComponentSKU</th>
              <th>QtyPerBOM</th>
              <th>Consumed Qty</th>
            </tr>
          </thead>
          <tbody>
            {detail.components.map((component) => (
              <tr key={component.componentSku}>
                <td>{component.componentSku}</td>
                <td>{component.qtyPerBom}</td>
                <td>{component.consumed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (detail.mode === 'Waterfall') {
    return (
      <div className="detail-panel">
        <table>
          <thead>
            <tr>
              <th>ComponentSKU</th>
              <th>QtyPerBOM</th>
              <th>Inventory Available</th>
              <th>Total Tier Demand</th>
              <th>Allocated</th>
              <th>Yield</th>
            </tr>
          </thead>
          <tbody>
            {detail.components.map((component) => (
              <tr key={component.componentSku} className={component.componentSku === detail.bottleneck ? 'hot-row' : ''}>
                <td>{component.componentSku}</td>
                <td>{component.qtyPerBom}</td>
                <td>{component.inventoryAvailable}</td>
                <td>{component.totalTierDemand}</td>
                <td>{component.allocatedQty}</td>
                <td>{component.yield}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="detail-panel">
      <p>Priority is zero or invalid. No inventory was consumed.</p>
    </div>
  );
}

export default function Dashboard({ calculation }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'parentSku', direction: 'asc' });
  const [expanded, setExpanded] = useState('');

  const stats = useMemo(() => {
    const results = calculation.results;
    return [
      { label: 'Total BOMs', value: results.length },
      { label: 'Reserved (UDF01=X)', value: results.filter((row) => row.mode === 'X').length },
      { label: 'Total AvailSOH', value: results.reduce((sum, row) => sum + row.availSoh, 0) },
      { label: 'Zero Stock BOMs', value: results.filter((row) => row.availSoh === 0).length },
    ];
  }, [calculation.results]);

  const rows = useMemo(() => {
    const filtered = calculation.results.filter((row) =>
      row.parentSku.toLowerCase().includes(query.trim().toLowerCase()),
    );
    return filtered.sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      const result =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right));
      return sort.direction === 'asc' ? result : -result;
    });
  }, [calculation.results, query, sort]);

  function toggleSort(key) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  return (
    <div className="page-grid">
      <section className="stats-grid">
        {stats.map((stat) => (
          <div className="stat-card" key={stat.label}>
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Results</h2>
            <p>Click a row to inspect allocation details</p>
          </div>
          <input
            className="search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search SKU"
          />
        </div>
        <div className="table-wrap results-table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                {columns.map(([key, label]) => (
                  <th key={key}>
                    <button type="button" className="sort-button" onClick={() => toggleSort(key)}>
                      {label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.parentSku}>
                  <tr
                    className="clickable-row"
                    onClick={() => setExpanded(expanded === row.parentSku ? '' : row.parentSku)}
                  >
                    <td>{expanded === row.parentSku ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                    <td>{row.parentSku}</td>
                    <td>{row.priorityScore}</td>
                    <td className={row.availSoh > 0 ? 'soh-positive' : 'soh-zero'}>{row.availSoh}</td>
                    <td>
                      <ModeBadge mode={row.mode} />
                    </td>
                    <td>{row.bottleneck || '-'}</td>
                  </tr>
                  {expanded === row.parentSku && (
                    <tr>
                      <td colSpan="6">
                        <DetailPanel detail={calculation.details[row.parentSku]} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
