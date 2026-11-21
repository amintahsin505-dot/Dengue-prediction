/**
 * DENGUARD AI — Next-Generation Urban Dengue Early Warning Platform
 * Frontend Orchestration Script
 * Built for EDU AI Engineering Hackathon 2026
 */

(function () {
  'use strict';

  // Application State
  const state = {
    city: 'All cities',
    start: '',
    end: '',
    horizon: 2,
    activeView: 'map',
    zoneFilter: 'All',
    mapMode: 'zones',
    meta: null,
    forecasts: [],
    metrics: null,
    validationData: null,
    lagData: null,
    selectedWardId: null,
    map: null,
    markersGroup: null,
    zonesGroup: null,
    heatLayer: null,
    charts: {}
  };

  const cityCoordinates = {
    'Chattogram': { center: [22.3569, 91.7832], zoom: 12 },
    'Dhaka North': { center: [23.8103, 90.4125], zoom: 12 },
    'Dhaka South': { center: [23.7204, 90.4074], zoom: 13 },
    'Gazipur': { center: [23.9980, 90.4240], zoom: 12 },
    'Narayanganj': { center: [23.6238, 90.5000], zoom: 13 },
    'All cities': { center: [23.72, 90.8], zoom: 8 }
  };

  // Helper Utilities
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const fmt = (num, decimals = 1) => Number(num || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  // REST API Client
  async function fetchAPI(endpoint, options = {}) {
    try {
      const response = await fetch(endpoint, options);
      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || errorJson.message || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      showAlert(`API Error: ${err.message}`);
      throw err;
    }
  }

  function showAlert(msg) {
    const banner = $('#alert-banner');
    const text = $('#alert-text');
    if (banner && text) {
      text.textContent = msg;
      banner.classList.remove('hidden');
    }
  }

  function hideLoading() {
    const overlay = $('#loading-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // Chart Management Helper
  function renderChart(id, type, data, options = {}) {
    if (state.charts[id]) {
      state.charts[id].destroy();
    }
    const canvas = document.getElementById(id);
    if (!canvas) return;

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } }
        },
        tooltip: {
          backgroundColor: '#111827',
          titleColor: '#fff',
          bodyColor: '#cbd5e1',
          borderColor: '#223249',
          borderWidth: 1,
          padding: 10
        }
      },
      scales: type === 'doughnut' || type === 'pie' ? {} : {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', size: 10 } }
        }
      }
    };

    state.charts[id] = new Chart(canvas, {
      type,
      data,
      options: { ...baseOptions, ...options }
    });
  }

  // =========================================================================
  // View Navigation System
  // =========================================================================
  function switchView(viewName) {
    state.activeView = viewName;
    $$('.app-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${viewName}`);
    });
    $$('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    // Invalidate map size when switching back to map
    if (viewName === 'map' && state.map) {
      setTimeout(() => state.map.invalidateSize(), 100);
    }

    if (viewName === 'overview') loadOverviewData();
    if (viewName === 'priorities') renderPrioritiesTable();
    if (viewName === 'pipeline') loadPipelineData();
    if (viewName === 'model') loadModelData();
    if (viewName === 'simulator') initSimulator();
  }

  // =========================================================================
  // Leaflet Map Initialization & 3-Zone Layer Rendering
  // =========================================================================
  function initLeafletMap() {
    if (state.map) return;
    const mapEl = document.getElementById('leaflet-city-map');
    if (!mapEl || !window.L) return;

    // Center on Bangladesh with comprehensive coverage
    state.map = L.map('leaflet-city-map', {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true
    }).setView([23.75, 90.65], 8);

    // Standard OpenStreetMap Tile Layer - 100% Free, NO API KEY REQUIRED
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.map);

    state.zonesGroup = L.layerGroup().addTo(state.map);
    state.markersGroup = L.layerGroup().addTo(state.map);

    renderMapLayers();
  }

  function getZoneColors(tier) {
    if (tier === 'High') {
      return { fill: '#ef4444', stroke: '#b91c1c', border: '#ef4444' };
    } else if (tier === 'Medium') {
      return { fill: '#f59e0b', stroke: '#b45309', border: '#f59e0b' };
    } else {
      return { fill: '#10b981', stroke: '#047857', border: '#10b981' };
    }
  }

  function renderMapLayers() {
    if (!state.map) return;

    state.zonesGroup.clearLayers();
    state.markersGroup.clearLayers();
    if (state.heatLayer) {
      state.map.removeLayer(state.heatLayer);
      state.heatLayer = null;
    }

    const filteredForecasts = state.forecasts.filter(w => {
      const matchCity = state.city === 'All cities' || w.city === state.city;
      const matchZone = state.zoneFilter === 'All' || w.risk_tier === state.zoneFilter;
      return matchCity && matchZone;
    });

    // Update Zone Counts in Header
    const allWardsInCity = state.city === 'All cities' ? state.forecasts : state.forecasts.filter(w => w.city === state.city);
    const countHigh = allWardsInCity.filter(w => w.risk_tier === 'High').length;
    const countMedium = allWardsInCity.filter(w => w.risk_tier === 'Medium').length;
    const countLow = allWardsInCity.filter(w => w.risk_tier === 'Low').length;

    $('#count-all').textContent = allWardsInCity.length;
    $('#count-high').textContent = countHigh;
    $('#count-medium').textContent = countMedium;
    $('#count-low').textContent = countLow;

    // Heatmap Mode
    if (state.mapMode === 'heatmap') {
      if (window.L && L.heatLayer) {
        const heatPoints = filteredForecasts.map(w => [
          w.lat,
          w.lng,
          Math.max(0.2, (w.risk_score || 50) / 100)
        ]);
        state.heatLayer = L.heatLayer(heatPoints, {
          radius: 35,
          blur: 25,
          maxZoom: 16,
          gradient: { 0.2: '#10b981', 0.5: '#f59e0b', 0.8: '#ef4444', 1.0: '#b91c1c' }
        }).addTo(state.map);
      }
      return;
    }

    // 3-Zone Catchment Circles Mode
    const bounds = [];

    filteredForecasts.forEach(ward => {
      const colors = getZoneColors(ward.risk_tier);
      const lat = ward.lat;
      const lng = ward.lng;
      bounds.push([lat, lng]);

      // 1. Semi-transparent Risk Catchment Circle (1.2 km radius)
      const circle = L.circle([lat, lng], {
        radius: 1300,
        fillColor: colors.fill,
        fillOpacity: ward.risk_tier === 'High' ? 0.38 : (ward.risk_tier === 'Medium' ? 0.30 : 0.22),
        color: colors.stroke,
        weight: 1.5,
        dashArray: ward.risk_tier === 'High' ? null : '4, 4'
      });

      circle.on('click', () => selectWard(ward.ward_id, false));
      state.zonesGroup.addLayer(circle);

      // 2. High-contrast Custom Pin Marker with Ward Number
      const wardNum = ward.ward_id.split('_').pop() || '';
      const pinHtml = `
        <div class="custom-map-pin pin-${ward.risk_tier}" title="${ward.ward_id} - ${ward.ward_name}">
          <span class="pin-badge">${wardNum}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        html: pinHtml,
        className: 'ward-div-icon',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      // Hover Tooltip
      marker.bindTooltip(`
        <div style="font-family:'Plus Jakarta Sans',sans-serif; padding:4px">
          <div style="font-size:10px; font-weight:800; color:${colors.fill}; text-transform:uppercase">${ward.risk_tier} RISK ZONE</div>
          <b style="font-size:12px; color:#fff">${ward.ward_id}: ${ward.ward_name}</b><br>
          <span style="font-size:11px; color:#cbd5e1">Predicted: <b>${fmt(ward.predicted_cases)} cases</b> (95% CI: ${fmt(ward.ci_lower_95)} - ${fmt(ward.ci_upper_95)})</span>
        </div>
      `, { direction: 'top', offset: [0, -10] });

      marker.on('click', () => selectWard(ward.ward_id, false));
      state.markersGroup.addLayer(marker);
    });

    // Auto-fit bounds: fit all 60 wards on All cities, or city bounds when a specific city is selected
    if (bounds.length > 0) {
      if (state.city === 'All cities') {
        state.map.fitBounds(bounds, { padding: [30, 30] });
      } else {
        state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    }
  }

  // =========================================================================
  // Ward Selection & Detail Inspector
  // =========================================================================
  function selectWard(wardId, shouldFly = false) {
    state.selectedWardId = wardId;
    const ward = state.forecasts.find(w => w.ward_id === wardId);
    if (!ward) return;

    // Show inspector
    const placeholder = $('#inspector-placeholder');
    const content = $('#inspector-content');
    if (placeholder && content) {
      placeholder.classList.add('hidden');
      content.classList.remove('hidden');
    }

    // Populate metadata
    $('#insp-city').textContent = ward.city;
    $('#insp-ward').textContent = ward.ward_id;
    $('#insp-name').textContent = ward.ward_name || ward.ward_id;
    $('#insp-landmark').textContent = ward.landmark || 'Municipal Ward Area';

    // Tier badge
    const tierBadge = $('#insp-tier');
    tierBadge.textContent = `${ward.risk_tier.toUpperCase()} RISK`;
    tierBadge.className = `inspector-tier-badge tier-${ward.risk_tier}`;

    // Prediction stats
    $('#insp-pred').textContent = fmt(ward.predicted_cases);
    $('#insp-ci').textContent = `95% CI: ${fmt(ward.ci_lower_95)} – ${fmt(ward.ci_upper_95)}`;
    $('#insp-score').textContent = fmt(ward.risk_score, 1);

    // Physical vulnerability matrix
    $('#insp-rain').textContent = `${fmt(ward.rainfall_accum_2_4w || (ward.rainfall_mm * 2.5), 1)} mm`;
    $('#insp-logging').textContent = fmt(ward.water_logging_risk_index, 2);
    $('#insp-sanitation').textContent = fmt(ward.sanitation_score, 2);
    $('#insp-density').textContent = `${Number(ward.population_density_sqkm || 0).toLocaleString()}/km²`;

    // Directive
    $('#insp-directive').textContent = ward.recommended_action || 'Maintain routine weekly larval surveillance.';

    // Driver Bars (Permutation Impact)
    const drivers = ward.drivers || {
      rainfall_lag_pct: 35.0,
      water_logging_pct: 28.0,
      crowding_density_pct: 20.0,
      sanitation_gap_pct: 17.0
    };

    const driverItems = [
      { name: '🌧️ 2-4W Lagged Rainfall Accumulation', pct: drivers.rainfall_lag_pct, color: '#38bdf8' },
      { name: '💧 Urban Water-Logging & Drain Stagnation', pct: drivers.water_logging_pct, color: '#f59e0b' },
      { name: '👥 Population Density & Vector Contact', pct: drivers.crowding_density_pct, color: '#a855f7' },
      { name: '🗑️ Sanitation Deficit & Container Waste', pct: drivers.sanitation_gap_pct, color: '#ef4444' }
    ];

    $('#insp-driver-bars').innerHTML = driverItems.map(d => `
      <div class="driver-row">
        <div class="driver-info">
          <span>${d.name}</span>
          <b>${fmt(d.pct)}%</b>
        </div>
        <div class="driver-bar-track">
          <div class="driver-bar-fill" style="width:${Math.min(100, Math.max(5, d.pct))}%; background:${d.color}"></div>
        </div>
      </div>
    `).join('');

    // Smoothly fly map to selected ward only if explicitly requested (e.g. from search)
    if (shouldFly && state.map && ward.lat && ward.lng) {
      state.map.flyTo([ward.lat, ward.lng], 13, { duration: 0.8 });
    }
  }

  // =========================================================================
  // Overview Dashboard Data Loader
  // =========================================================================
  async function loadOverviewData() {
    const q = new URLSearchParams({
      city: state.city,
      ...(state.start ? { start: state.start } : {}),
      ...(state.end ? { end: state.end } : {})
    });

    const [summary, trends, citySummary] = await Promise.all([
      fetchAPI(`/api/summary?${q}`),
      fetchAPI(`/api/trends?${q}`),
      fetchAPI(`/api/city-summary?horizon=${state.horizon}`)
    ]);

    // KPI Cards
    $('#kpi-cases').textContent = Number(summary.cases || 0).toLocaleString();
    $('#kpi-records').textContent = Number(summary.records || 0).toLocaleString();
    $('#kpi-wards').textContent = summary.wards;

    // Trend Chart
    const trendLabels = trends.map(t => t.date);
    const trendCases = trends.map(t => t.cases);
    renderChart('chart-trends', 'line', {
      labels: trendLabels,
      datasets: [{
        label: 'Weekly Dengue Cases',
        data: trendCases,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.12)',
        fill: true,
        tension: 0.25,
        borderWidth: 2,
        pointRadius: 0
      }]
    });

    // City Burden Chart
    renderChart('chart-city-burden', 'bar', {
      labels: citySummary.map(c => c.city),
      datasets: [{
        label: 'Historical Cases',
        data: citySummary.map(c => c.historical_cases),
        backgroundColor: '#3b82f6',
        borderRadius: 4
      }]
    }, { indexAxis: 'y' });

    // Top 10 Priority Wards Table
    const topWards = state.forecasts
      .filter(w => state.city === 'All cities' || w.city === state.city)
      .slice(0, 10);

    $('#top-wards-tbody').innerHTML = topWards.map(w => `
      <tr onclick="app.selectAndGoToWard('${w.ward_id}')" style="cursor:pointer">
        <td><b>${w.city}</b></td>
        <td><code>${w.ward_id}</code></td>
        <td>${w.ward_name}</td>
        <td><b>${fmt(w.predicted_cases)}</b> <small style="color:#06b6d4">[${fmt(w.ci_lower_95)} - ${fmt(w.ci_upper_95)}]</small></td>
        <td><b>${fmt(w.risk_score)}</b></td>
        <td><span class="inspector-tier-badge tier-${w.risk_tier}">${w.risk_tier}</span></td>
        <td style="font-size:11px; color:#cbd5e1">${w.recommended_action || 'Routine monitoring'}</td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="loading-td">No wards available for current selection.</td></tr>';
  }

  // =========================================================================
  // Priorities Table Renderer
  // =========================================================================
  function renderPrioritiesTable() {
    const searchVal = ($('#table-search')?.value || '').toLowerCase().trim();
    const tierVal = $('#table-tier-filter')?.value || 'All';
    const cityVal = $('#table-city-filter')?.value || 'All cities';

    let rows = state.forecasts.filter(w => {
      const matchCity = cityVal === 'All cities' || w.city === cityVal;
      const matchTier = tierVal === 'All' || w.risk_tier === tierVal;
      const matchSearch = !searchVal || 
        w.ward_id.toLowerCase().includes(searchVal) ||
        (w.ward_name && w.ward_name.toLowerCase().includes(searchVal)) ||
        (w.landmark && w.landmark.toLowerCase().includes(searchVal)) ||
        w.city.toLowerCase().includes(searchVal);
      return matchCity && matchTier && matchSearch;
    });

    $('#table-row-count').textContent = rows.length;

    $('#priorities-tbody').innerHTML = rows.map((w, idx) => `
      <tr onclick="app.selectAndGoToWard('${w.ward_id}')" style="cursor:pointer">
        <td>${idx + 1}</td>
        <td><b>${w.city}</b></td>
        <td><code>${w.ward_id}</code></td>
        <td>
          <b>${w.ward_name}</b><br>
          <small style="color:#64748b">${w.landmark}</small>
        </td>
        <td>
          <b>${fmt(w.predicted_cases)}</b>
          <span style="font-family:var(--font-mono); font-size:10px; color:#06b6d4; display:block">
            [${fmt(w.ci_lower_95)} – ${fmt(w.ci_upper_95)}]
          </span>
        </td>
        <td><b>${fmt(w.risk_score)}</b></td>
        <td><span class="inspector-tier-badge tier-${w.risk_tier}">${w.risk_tier}</span></td>
        <td style="font-size:11px">
          ${w.drivers?.rainfall_lag_pct > 30 ? '🌧️ Lagged Rain' : '💧 Drainage Risk'}
        </td>
        <td style="font-size:11px; max-width:260px; white-space:normal; color:#cbd5e1">
          ${w.recommended_action || 'Routine surveillance'}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="9" class="loading-td">No matching wards found.</td></tr>';
  }

  // =========================================================================
  // Multi-Week Weather Lag Pipeline View (Criterion 2)
  // =========================================================================
  async function loadPipelineData() {
    if (!state.lagData) {
      state.lagData = await fetchAPI('/api/lag-analysis');
    }
    const lag = state.lagData;

    // Correlation Bar Chart
    renderChart('chart-lag-correlation', 'bar', {
      labels: ['Same-Day Rain', '1-Week Lag', '2-Week Lag', '3-Week Lag (Peak)', '4-Week Lag', '2-4W Accumulation'],
      datasets: [{
        label: 'Correlation with Hospital Dengue Cases (r)',
        data: [lag.same_day_rain, lag.lag_1_week, lag.lag_2_weeks, lag.lag_3_weeks, lag.lag_4_weeks, lag.accum_2_4w],
        backgroundColor: ['#64748b', '#38bdf8', '#0284c7', '#ef4444', '#0284c7', '#10b981'],
        borderRadius: 4
      }]
    }, {
      scales: {
        y: { beginAtZero: true, max: 1.0, title: { display: true, text: 'Pearson Correlation (r)', color: '#94a3b8' } }
      }
    });

    // Overlay Chart (Rain vs Shifted Cases)
    const trends = await fetchAPI(`/api/trends?city=${state.city}`);
    const sample = trends.slice(-52); // Past 1 year

    renderChart('chart-lag-overlay', 'line', {
      labels: sample.map(s => s.date),
      datasets: [
        {
          label: 'Rainfall (mm)',
          data: sample.map(s => s.rainfall),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.2)',
          yAxisID: 'yRain',
          tension: 0.2,
          pointRadius: 0
        },
        {
          label: 'Reported Dengue Cases',
          data: sample.map(s => s.cases),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          yAxisID: 'yCases',
          tension: 0.2,
          pointRadius: 0
        }
      ]
    }, {
      scales: {
        yRain: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'Rainfall (mm)', color: '#38bdf8' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        yCases: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'Dengue Cases', color: '#ef4444' },
          grid: { drawOnChartArea: false }
        }
      }
    });
  }

  // =========================================================================
  // Model Evaluation & Diagnostics View (Criterion 5 + Bonus 3)
  // =========================================================================
  async function loadModelData() {
    if (!state.metrics) {
      state.metrics = await fetchAPI('/api/metrics');
    }
    const m = state.metrics.metrics[state.horizon];

    // Model Metric KPI Cards
    $('#model-metrics-grid').innerHTML = `
      <div class="kpi-card">
        <div class="kpi-icon-wrap" style="background:rgba(16,185,129,0.15); color:#10b981">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="kpi-info">
          <span class="kpi-lbl">${state.horizon}-Week Holdout MAE</span>
          <b class="kpi-value">${fmt(m.mae, 3)}</b>
          <span class="kpi-sub">Zero-Baseline MAE: ${fmt(m.zero_baseline_mae, 3)}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrap" style="background:rgba(59,130,246,0.15); color:#3b82f6">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
        </div>
        <div class="kpi-info">
          <span class="kpi-lbl">Holdout R² Score</span>
          <b class="kpi-value">${fmt(m.r2, 3)}</b>
          <span class="kpi-sub">Validation Rows: ${m.validation_rows}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrap" style="background:rgba(239,68,68,0.15); color:#ef4444">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div class="kpi-info">
          <span class="kpi-lbl">Outbreak Recall (≥1)</span>
          <b class="kpi-value">${(m.recall * 100).toFixed(1)}%</b>
          <span class="kpi-sub">False Negatives: ${m.false_negatives}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-icon-wrap" style="background:rgba(245,158,11,0.15); color:#f59e0b">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div class="kpi-info">
          <span class="kpi-lbl">95% CI Error Margin</span>
          <b class="kpi-value">±${fmt(m.ci_margin_95, 2)}</b>
          <span class="kpi-sub">Empirical RMSE Standard Error</span>
        </div>
      </div>
    `;

    // Metrics Comparison Table
    $('#metrics-tbody').innerHTML = [2, 4].map(h => {
      const item = state.metrics.metrics[h];
      const errorReduction = ((1 - item.mae / item.zero_baseline_mae) * 100).toFixed(1);
      return `
        <tr>
          <td><b>${h}-Week Model</b></td>
          <td><b>${fmt(item.mae, 3)}</b></td>
          <td>${fmt(item.zero_baseline_mae, 3)}</td>
          <td><span class="badge-success">-${errorReduction}%</span></td>
          <td>${fmt(item.rmse, 3)}</td>
          <td><b>${fmt(item.r2, 3)}</b></td>
          <td><b>${(item.recall * 100).toFixed(1)}%</b></td>
          <td>${(item.precision * 100).toFixed(1)}%</td>
          <td>${item.false_negatives}</td>
          <td><code style="color:#06b6d4">±${fmt(item.ci_margin_95, 2)}</code></td>
        </tr>
      `;
    }).join('');

    // Feature Importance Chart
    const imp = state.metrics.importance[state.horizon].slice(0, 10).reverse();
    renderChart('chart-feature-importance', 'bar', {
      labels: imp.map(i => i.feature),
      datasets: [{
        label: 'Permutation Importance (MAE Increase)',
        data: imp.map(i => i.importance),
        backgroundColor: '#0284c7',
        borderRadius: 4
      }]
    }, { indexAxis: 'y' });

    // Chronological Holdout Timeseries (Actual vs Predicted)
    const valDetails = await fetchAPI(`/api/validation-details?horizon=${state.horizon}`);
    const series = valDetails.series || [];

    renderChart('chart-val-timeseries', 'line', {
      labels: series.map(s => s.date),
      datasets: [
        {
          label: 'Actual dengue cases',
          data: series.map(s => s.actual),
          borderColor: '#ef4444',
          tension: 0.2,
          pointRadius: 0
        },
        {
          label: 'Model Predicted',
          data: series.map(s => s.predicted),
          borderColor: '#10b981',
          borderDash: [4, 4],
          tension: 0.2,
          pointRadius: 0
        }
      ]
    });
  }

  // =========================================================================
  // Public Health "What-If" Scenario Simulator
  // =========================================================================
  function initSimulator() {
    const sliderRain = $('#sim-rain');
    const sliderTemp = $('#sim-temp');
    const sliderSan = $('#sim-san');

    const updateLabels = () => {
      $('#lbl-rain-delta').textContent = `+${sliderRain.value} mm`;
      $('#lbl-temp-delta').textContent = `${Number(sliderTemp.value) > 0 ? '+' : ''}${sliderTemp.value} °C`;
      $('#lbl-san-delta').textContent = `+${Number(sliderSan.value).toFixed(2)}`;
    };

    sliderRain.oninput = updateLabels;
    sliderTemp.oninput = updateLabels;
    sliderSan.oninput = updateLabels;

    $('#btn-run-sim').onclick = runSimulation;
    $('#btn-reset-sim').onclick = () => {
      sliderRain.value = 0;
      sliderTemp.value = 0;
      sliderSan.value = 0;
      updateLabels();
      runSimulation();
    };

    runSimulation();
  }

  async function runSimulation() {
    const rain = Number($('#sim-rain')?.value || 0);
    const temp = Number($('#sim-temp')?.value || 0);
    const san = Number($('#sim-san')?.value || 0);

    const payload = await fetchAPI(`/api/simulate?rainfall_delta=${rain}&temp_delta=${temp}&sanitation_delta=${san}&horizon=${state.horizon}`);
    const results = payload.results || [];

    const simHigh = results.filter(w => w.risk_tier === 'High').length;
    const simMed = results.filter(w => w.risk_tier === 'Medium').length;
    const simLow = results.filter(w => w.risk_tier === 'Low').length;
    const totalCases = results.reduce((acc, w) => acc + (w.predicted_cases || 0), 0);

    $('#sim-count-high').textContent = simHigh;
    $('#sim-count-medium').textContent = simMed;
    $('#sim-count-low').textContent = simLow;
    $('#sim-total-cases').textContent = fmt(totalCases, 0);

    // Difference badges
    $('#sim-diff-high').textContent = `Simulated: ${simHigh} Wards`;
    $('#sim-diff-medium').textContent = `Simulated: ${simMed} Wards`;
    $('#sim-diff-low').textContent = `Simulated: ${simLow} Wards`;

    // Render results in table
    $('#sim-tbody').innerHTML = results.slice(0, 15).map(w => `
      <tr>
        <td><b>${w.city}</b></td>
        <td><code>${w.ward_id}</code></td>
        <td>${w.ward_name}</td>
        <td><b>${fmt(w.predicted_cases)}</b> <small style="color:#06b6d4">[${fmt(w.ci_lower_95)} - ${fmt(w.ci_upper_95)}]</small></td>
        <td><b>${fmt(w.risk_score)}</b></td>
        <td><span class="inspector-tier-badge tier-${w.risk_tier}">${w.risk_tier}</span></td>
        <td style="font-size:11px; color:#38bdf8">${w.risk_tier === 'High' ? '⚠️ High Priority' : 'Stabilized'}</td>
      </tr>
    `).join('');
  }

  // =========================================================================
  // Global Search & Autocomplete
  // =========================================================================
  function initGlobalSearch() {
    const searchInput = $('#global-search');
    const dropdown = $('#search-suggestions');
    if (!searchInput || !dropdown) return;

    // Keyboard shortcut '/'
    window.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
    });

    searchInput.addEventListener('input', e => {
      const term = e.target.value.toLowerCase().trim();
      if (!term || term.length < 2) {
        dropdown.classList.add('hidden');
        return;
      }

      const matches = state.forecasts.filter(w => 
        w.ward_id.toLowerCase().includes(term) ||
        (w.ward_name && w.ward_name.toLowerCase().includes(term)) ||
        (w.landmark && w.landmark.toLowerCase().includes(term)) ||
        w.city.toLowerCase().includes(term)
      ).slice(0, 6);

      if (!matches.length) {
        dropdown.innerHTML = '<div style="padding:12px; color:#94a3b8; font-size:12px">No matching wards found.</div>';
        dropdown.classList.remove('hidden');
        return;
      }

      dropdown.innerHTML = matches.map(w => `
        <div class="search-suggestion-item" data-ward="${w.ward_id}">
          <div class="sug-left">
            <b>${w.ward_id}: ${w.ward_name}</b>
            <span>${w.city} · ${w.landmark}</span>
          </div>
          <span class="inspector-tier-badge tier-${w.risk_tier}">${w.risk_tier}</span>
        </div>
      `).join('');

      dropdown.classList.remove('hidden');
    });

    dropdown.addEventListener('click', e => {
      const item = e.target.closest('.search-suggestion-item');
      if (item) {
        const wid = item.dataset.ward;
        searchInput.value = '';
        dropdown.classList.add('hidden');
        selectAndGoToWard(wid);
      }
    });

    // Close on click outside
    document.addEventListener('click', e => {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  function selectAndGoToWard(wardId) {
    switchView('map');
    selectWard(wardId, true);
  }

  // =========================================================================
  // Master Data Refresh & Bootstrap
  // =========================================================================
  async function loadAllData() {
    try {
      // 1. Metadata
      state.meta = await fetchAPI('/api/meta');
      const citySelect = $('#city-select');
      const tableCityFilter = $('#table-city-filter');

      const cityOptions = '<option value="All cities">All Municipalities (All 5 Cities)</option>' +
        state.meta.cities.map(c => `<option value="${c}">${c}</option>`).join('');

      if (citySelect) citySelect.innerHTML = cityOptions;
      if (tableCityFilter) tableCityFilter.innerHTML = cityOptions;

      if (!state.start) state.start = state.meta.coverage_start;
      if (!state.end) state.end = state.meta.coverage_end;
      $('#date-start').value = state.start;
      $('#date-end').value = state.end;
      $('#kpi-date-range').textContent = `${state.start} to ${state.end}`;

      // 2. Forecasts
      state.forecasts = await fetchAPI(`/api/forecasts?city=All%20cities&horizon=${state.horizon}`);

      // 3. Render Views
      initLeafletMap();
      renderMapLayers();

      // Populate inspector with default ward without shifting map view
      const defaultWard = state.selectedWardId || 'CCC_Ward_08';
      selectWard(defaultWard, false);

      hideLoading();
    } catch (err) {
      hideLoading();
      console.error('Failed to bootstrap DENGUARD:', err);
    }
  }

  // =========================================================================
  // Event Listeners Setup
  // =========================================================================
  function initEventListeners() {
    // Nav Tabs
    $('#main-nav').addEventListener('click', e => {
      const tab = e.target.closest('.nav-tab');
      if (tab) switchView(tab.dataset.view);
    });

    // Horizon Switch
    $$('.horizon-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        $$('.horizon-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.horizon = Number(btn.dataset.horizon);
        state.forecasts = await fetchAPI(`/api/forecasts?city=All%20cities&horizon=${state.horizon}`);
        renderMapLayers();
        if (state.selectedWardId) selectWard(state.selectedWardId);
        if (state.activeView === 'overview') loadOverviewData();
        if (state.activeView === 'priorities') renderPrioritiesTable();
        if (state.activeView === 'model') loadModelData();
      });
    });

    // Zone Filter Pills on Map
    $$('.zone-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        $$('.zone-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.zoneFilter = pill.dataset.filterZone;
        renderMapLayers();
      });
    });

    // City Quick Pills on Map
    $$('.city-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        $$('.city-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const cityName = pill.dataset.city;
        state.city = cityName;
        $('#city-select').value = cityName;
        
        const coords = cityCoordinates[cityName] || cityCoordinates['All cities'];
        if (state.map && coords) {
          state.map.flyTo(coords.center, coords.zoom, { duration: 1.0 });
        }
        renderMapLayers();
      });
    });

    // City Dropdown Ribbon
    $('#city-select').addEventListener('change', e => {
      state.city = e.target.value;
      $$('.city-pill').forEach(p => p.classList.toggle('active', p.dataset.city === state.city));
      const coords = cityCoordinates[state.city] || cityCoordinates['All cities'];
      if (state.map && coords) {
        state.map.flyTo(coords.center, coords.zoom, { duration: 1.0 });
      }
      renderMapLayers();
      if (state.activeView === 'overview') loadOverviewData();
      if (state.activeView === 'priorities') renderPrioritiesTable();
    });

    // Map Mode Radios
    $$('input[name="map-mode"]').forEach(radio => {
      radio.addEventListener('change', e => {
        state.mapMode = e.target.value;
        renderMapLayers();
      });
    });

    // Table Filters
    $('#table-search')?.addEventListener('input', renderPrioritiesTable);
    $('#table-tier-filter')?.addEventListener('change', renderPrioritiesTable);
    $('#table-city-filter')?.addEventListener('change', renderPrioritiesTable);

    // Refresh & Export
    $('#btn-refresh').addEventListener('click', loadAllData);
    $('#btn-export-top').addEventListener('click', () => {
      window.location.href = `/api/export?city=${encodeURIComponent(state.city)}&horizon=${state.horizon}`;
    });
    $('#btn-export-table').addEventListener('click', () => {
      window.location.href = `/api/export?city=${encodeURIComponent(state.city)}&horizon=${state.horizon}`;
    });

    // Reset Filters
    $('#btn-reset-filters').addEventListener('click', () => {
      state.city = 'All cities';
      $('#city-select').value = 'All cities';
      $$('.city-pill').forEach(p => p.classList.toggle('active', p.dataset.city === 'All cities'));
      state.zoneFilter = 'All';
      $$('.zone-pill').forEach(p => p.classList.toggle('active', p.dataset.filterZone === 'All'));
      renderMapLayers();
    });

    initGlobalSearch();
  }

  // Public Exposure for Inline Events
  window.app = {
    switchView,
    selectAndGoToWard,
    selectWard
  };

  // Start App
  window.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadAllData();
  });

})();
