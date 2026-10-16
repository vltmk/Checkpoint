import { useEffect, useMemo, useState } from 'react';
import { trackerDB } from '../../lib/db';
import { computeLedgerMetrics, normalizeLedgerFilters, sortLedgerRows } from '../../lib/ledgerQuery';

const EMPTY_FACETS = { total: 0, statusCounts: {}, gameCounts: {} };

/**
 * Data for the ledger view, loaded a page at a time.
 *
 * - filteredRows: lightweight index rows for every filter (search, game, dates, ...) plus the status tab,
 *   in display order. Totals, status counts and page math all come from this list.
 * - metricsRows: the same rows without the status tab, in canonical date order. The metric cards read this,
 *   so they keep reflecting the whole filtered ledger exactly as before.
 * - pageRows: full rows for the current page only.
 * - selectedRows: full rows for the current selection (may span pages).
 * - facets: counts over every entry (total, per status, per game), for the menus and headline numbers.
 *
 * Money is converted by the existing functions in currencies.js; this hook only decides which rows to load.
 */
export function useLedgerData({
  rawFilters,
  sortOption,
  statusFilter,
  currentPage,
  pageSize,
  selectedIds,
  globalCurrency,
  rates,
  dataVersion,
  profileId,
}) {
  const filterKey = JSON.stringify(normalizeLedgerFilters(rawFilters));
  const filters = useMemo(() => normalizeLedgerFilters(rawFilters), [filterKey]);
  const dateOrder = sortOption === 'date_asc' ? 'date_asc' : 'date_desc';

  const [baseRows, setBaseRows] = useState([]);
  const [facets, setFacets] = useState(EMPTY_FACETS);
  const [pageRows, setPageRows] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  // Set when a query fails, so the view can say so instead of showing an empty ledger
  const [loadError, setLoadError] = useState(null);

  // Rows matching every filter except status. Status is applied in memory below, so changing the tab
  // does not query again.
  useEffect(() => {
    let cancelled = false;
    trackerDB.queryLedgerIndex({ ...filters, status: '' }, dateOrder).then((rows) => {
      if (!cancelled) {
        setBaseRows(rows);
        setLoadError(null);
      }
    }).catch((err) => {
      if (!cancelled) setLoadError(err);
    });
    return () => {
      cancelled = true;
    };
  }, [filters, dateOrder, dataVersion, profileId]);

  useEffect(() => {
    let cancelled = false;
    trackerDB.getLedgerFacets().then((next) => {
      if (!cancelled) setFacets(next);
    }).catch((err) => {
      if (!cancelled) setLoadError(err);
    });
    return () => {
      cancelled = true;
    };
  }, [dataVersion, profileId]);

  const sortedRows = useMemo(
    () => (sortOption === 'income_desc' || sortOption === 'income_asc'
      ? sortLedgerRows(baseRows, sortOption, globalCurrency, rates)
      : baseRows),
    [baseRows, sortOption, globalCurrency, rates]
  );

  const filteredRows = useMemo(
    () => (statusFilter && statusFilter !== 'ALL' ? sortedRows.filter((row) => row.status === statusFilter) : sortedRows),
    [sortedRows, statusFilter]
  );

  const metricsRows = useMemo(() => sortLedgerRows(baseRows, 'date_desc'), [baseRows]);

  const metrics = useMemo(
    () => computeLedgerMetrics(metricsRows, globalCurrency, rates),
    [metricsRows, globalCurrency, rates]
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageIds = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize).map((row) => row.id);
  }, [filteredRows, safePage, pageSize]);
  const pageKey = pageIds.join('|');

  useEffect(() => {
    let cancelled = false;
    if (pageIds.length === 0) {
      setPageRows([]);
      return undefined;
    }
    trackerDB.getLedgerRowsByIds(pageIds).then((rows) => {
      if (!cancelled) setPageRows(rows);
    }).catch((err) => {
      if (!cancelled) setLoadError(err);
    });
    return () => {
      cancelled = true;
    };
    // pageIds is derived from pageKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey, dataVersion]);

  const selectedKey = Array.from(selectedIds || []).join('|');
  useEffect(() => {
    let cancelled = false;
    const ids = selectedKey ? selectedKey.split('|') : [];
    if (ids.length === 0) {
      setSelectedRows([]);
      return undefined;
    }
    trackerDB.getLedgerRowsByIds(ids).then((rows) => {
      if (!cancelled) setSelectedRows(rows);
    }).catch((err) => {
      if (!cancelled) setLoadError(err);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedKey, dataVersion]);

  return {
    sortedRows,
    filteredRows,
    metricsRows,
    metrics,
    totalPages,
    pageRows,
    selectedRows,
    facets,
    loadError,
  };
}
