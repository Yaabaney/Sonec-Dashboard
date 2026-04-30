let demandCapacityChart;
let lossesChart;
let outagesChart;
let generationMixChart;
let somaliaMapInstance = null;

let utilityDataCache = [];
let activeUtility = "All";

function formatNumber(value, decimals = 1) {
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toFixed(decimals);
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function shortenText(text, maxLength = 140) {
  if (!text) return "No summary available.";

  const clean = text.replace(/\s+/g, " ").trim();

  if (clean.length <= maxLength) return clean;

  const shortened = clean.slice(0, maxLength);
  const lastSpace = shortened.lastIndexOf(" ");

  return `${shortened.slice(0, lastSpace > 0 ? lastSpace : maxLength).trim()}...`;
}

function getOverallStatus(alerts) {
  if (alerts.some(a => (a.severity || "").toLowerCase() === "red")) {
    return { label: "Critical Status", className: "status-red" };
  }
  if (alerts.some(a => (a.severity || "").toLowerCase() === "amber")) {
    return { label: "Under Watch", className: "status-amber" };
  }
  return { label: "System Stable", className: "status-green" };
}

function renderStatusBadge(alerts) {
  const badge = document.getElementById("system-status-badge");
  const status = getOverallStatus(alerts);
  badge.textContent = status.label;
  badge.className = `status-badge ${status.className}`;
}

function renderAlerts(alerts) {
  const container = document.getElementById("alerts-container");
  container.innerHTML = "";

  if (!alerts || alerts.length === 0) {
    container.innerHTML = "<p>No alerts available.</p>";
    return;
  }

  alerts.forEach((alert) => {
    const severity = (alert.severity || "").toLowerCase();
    const card = document.createElement("div");
    card.className = `alert-card alert-${severity}`;

    card.innerHTML = `
      <h3>${alert.severity}: ${alert.title}</h3>
      <p>${alert.message}</p>
    `;

    container.appendChild(card);
  });
}

function applyKpiCardStyles(kpis) {
  const reserveCard = document.getElementById("card-reserve-margin");
  const lossesCard = document.getElementById("card-losses");
  const outagesCardElement = document.getElementById("card-total-outages");

  reserveCard.classList.remove("good", "warn", "bad");
  lossesCard.classList.remove("good", "warn", "bad");
  outagesCardElement.classList.remove("good", "warn", "bad");

  const reserve = Number(kpis.reserve_margin_percent);
  const losses = Number(kpis.losses_percent);
  const outages = Number(kpis.total_outages);

  if (reserve < 5) reserveCard.classList.add("bad");
  else if (reserve < 10) reserveCard.classList.add("warn");
  else reserveCard.classList.add("good");

  if (losses > 18) lossesCard.classList.add("bad");
  else if (losses > 13.5) lossesCard.classList.add("warn");
  else lossesCard.classList.add("good");

  if (outages >= 5) outagesCardElement.classList.add("bad");
  else if (outages >= 2) outagesCardElement.classList.add("warn");
  else outagesCardElement.classList.add("good");
}

function renderDemandCapacityChart(trends) {
  const ctx = document.getElementById("demandCapacityChart").getContext("2d");

  if (demandCapacityChart) demandCapacityChart.destroy();

  demandCapacityChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: trends.dates,
      datasets: [
        {
          label: "Peak Demand (MW)",
          data: trends.peak_demand_mw,
          borderColor: "#001486",
          backgroundColor: "rgba(0, 20, 134, 0.12)",
          tension: 0.3
        },
        {
          label: "Available Capacity (MW)",
          data: trends.available_capacity_mw,
          borderColor: "#0D9488",
          backgroundColor: "rgba(13, 148, 136, 0.12)",
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function renderLossesChart(trends) {
  const ctx = document.getElementById("lossesChart").getContext("2d");

  if (lossesChart) lossesChart.destroy();

  lossesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: trends.dates,
      datasets: [
        {
          label: "Losses (%)",
          data: trends.losses_percent,
          borderColor: "#0D9488",
          backgroundColor: "rgba(13, 148, 136, 0.12)",
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function renderOutagesChart(trends) {
  const ctx = document.getElementById("outagesChart").getContext("2d");

  if (outagesChart) outagesChart.destroy();

  outagesChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: trends.dates,
      datasets: [
        {
          label: "Total Outages",
          data: trends.number_of_outages,
          backgroundColor: "rgba(0, 20, 134, 0.75)"
        },
        {
          label: "Unplanned Outages",
          data: trends.unplanned_outages,
          backgroundColor: "rgba(13, 148, 136, 0.75)"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function renderGenerationMixChart(kpis) {
  const ctx = document.getElementById("generationMixChart").getContext("2d");

  if (generationMixChart) generationMixChart.destroy();

  const solar = Number(kpis.solar_output_mwh || 0);
  const battery = Number(kpis.battery_output_mwh || 0);
  const peakDemandProxy = Number(kpis.total_peak_demand_mw || 0);
  const remaining = Math.max((peakDemandProxy * 24) - solar - battery, 0);

  generationMixChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Thermal / Other", "Solar", "Battery"],
      datasets: [
        {
          data: [remaining, solar, battery],
          backgroundColor: ["#001486", "#0D9488", "#94a3b8"]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function renderSomaliaMap() {
  const mapContainer = document.getElementById("somaliaMap");
  if (!mapContainer) return;

  if (somaliaMapInstance) {
    somaliaMapInstance.remove();
    somaliaMapInstance = null;
  }

  const somaliaBounds = L.latLngBounds(
    [-1.2, 41.2],
    [11.9, 51.3]
  );

  somaliaMapInstance = L.map("somaliaMap", {
    maxBounds: somaliaBounds,
    maxBoundsViscosity: 1.0,
    minZoom: 6,
    maxZoom: 9
  });

  somaliaMapInstance.fitBounds(somaliaBounds);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(somaliaMapInstance);

  L.marker([2.0469, 45.3182]).addTo(somaliaMapInstance).bindPopup("Mogadishu");
  L.marker([10.3182, 43.2864]).addTo(somaliaMapInstance).bindPopup("Hargeisa");
  L.marker([8.4064, 48.4828]).addTo(somaliaMapInstance).bindPopup("Bosaso");
  L.marker([0.3556, 42.5453]).addTo(somaliaMapInstance).bindPopup("Kismayo");
}

function getUtilityStatus(item) {
  if (item.reserve_margin_percent < 5 || item.losses_percent > 18 || item.unplanned_outages >= 4) {
    return "Red";
  }
  if (item.reserve_margin_percent < 10 || item.losses_percent > 13.5 || item.unplanned_outages >= 2) {
    return "Amber";
  }
  return "Green";
}

function buildUtilityData(kpis) {
  const baseUtilities = [
    { name: "BECO", share: 0.42 },
    { name: "Blue Sky", share: 0.24 },
    { name: "Mogadishu Power", share: 0.34 }
  ];

  const utilities = baseUtilities.map((u, index) => {
    const peak = kpis.total_peak_demand_mw * u.share;
    const capacityFactor = index === 0 ? 1.24 : index === 1 ? 1.20 : 1.28;
    const capacity = peak * capacityFactor;
    const outages = index === 0 ? Math.max(kpis.total_outages, 1) : Math.max(kpis.total_outages - 1, 0);
    const unplanned = index === 1 ? Math.max(kpis.unplanned_outages, 1) : Math.max(kpis.unplanned_outages - (index === 2 ? 1 : 0), 0);
    const losses = index === 0 ? kpis.losses_percent + 0.3 : index === 1 ? kpis.losses_percent + 0.8 : kpis.losses_percent - 0.5;
    const solar = kpis.solar_output_mwh * u.share;
    const battery = kpis.battery_output_mwh * u.share;
    const reserveMarginPercent = peak > 0 ? ((capacity - peak) / peak) * 100 : 0;

    return {
      name: u.name,
      peak_demand_mw: peak,
      available_capacity_mw: capacity,
      outages,
      unplanned_outages: unplanned,
      losses_percent: losses,
      solar_output_mwh: solar,
      battery_output_mwh: battery,
      reserve_margin_percent: reserveMarginPercent
    };
  });

  const totalStatus = getUtilityStatus({
    reserve_margin_percent: kpis.reserve_margin_percent,
    losses_percent: kpis.losses_percent,
    unplanned_outages: kpis.unplanned_outages
  });

  const allRow = {
    name: "All",
    peak_demand_mw: kpis.total_peak_demand_mw,
    available_capacity_mw: kpis.total_available_capacity_mw,
    outages: kpis.total_outages,
    unplanned_outages: kpis.unplanned_outages,
    losses_percent: kpis.losses_percent,
    solar_output_mwh: kpis.solar_output_mwh,
    battery_output_mwh: kpis.battery_output_mwh,
    reserve_margin_percent: kpis.reserve_margin_percent,
    status: totalStatus
  };

  utilities.forEach((u) => {
    u.status = getUtilityStatus(u);
  });

  return [allRow, ...utilities];
}

function renderUtilityTable(data, selectedUtility) {
  const tbody = document.getElementById("utility-table-body");
  tbody.innerHTML = "";

  const rows = selectedUtility === "All"
    ? data
    : data.filter(item => item.name === selectedUtility);

  rows.forEach((item) => {
    const tr = document.createElement("tr");
    const statusClass = item.status.toLowerCase();

    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${formatNumber(item.peak_demand_mw, 1)}</td>
      <td>${formatNumber(item.available_capacity_mw, 1)}</td>
      <td>${formatNumber(item.outages, 0)}</td>
      <td>${formatNumber(item.unplanned_outages, 0)}</td>
      <td>${formatNumber(item.losses_percent, 2)}</td>
      <td>${formatNumber(item.solar_output_mwh, 1)}</td>
      <td>${formatNumber(item.battery_output_mwh, 1)}</td>
      <td><span class="status-pill ${statusClass}">${item.status}</span></td>
    `;

    tbody.appendChild(tr);
  });
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      activeUtility = button.dataset.utility;
      renderUtilityTable(utilityDataCache, activeUtility);
    });
  });
}

function renderDashboard(dashboardData, alertsData, summaryData) {
  const kpis = dashboardData.kpis;
  const trends = dashboardData.trends;

  setText("report-date", dashboardData.date);
  setText("executive-summary", shortenText(summaryData.executive_summary, 135));
  setText("operations-summary", shortenText(summaryData.operations_summary, 135));

  setText("kpi-peak-demand", formatNumber(kpis.total_peak_demand_mw, 1));
  setText("kpi-available-capacity", formatNumber(kpis.total_available_capacity_mw, 1));
  setText("kpi-reserve-margin", formatNumber(kpis.reserve_margin_percent, 1));
  setText("kpi-total-outages", formatNumber(kpis.total_outages, 0));
  setText("kpi-losses", formatNumber(kpis.losses_percent, 2));
  setText("kpi-generators-out", formatNumber(kpis.generators_out_of_service, 0));
  setText("kpi-solar-output", formatNumber(kpis.solar_output_mwh, 1));
  setText("kpi-battery-output", formatNumber(kpis.battery_output_mwh, 1));

  renderStatusBadge(alertsData);
  renderAlerts(alertsData);
  applyKpiCardStyles(kpis);
  renderSomaliaMap();
  renderDemandCapacityChart(trends);
  renderLossesChart(trends);
  renderOutagesChart(trends);
  renderGenerationMixChart(kpis);

  utilityDataCache = buildUtilityData(kpis);
  renderUtilityTable(utilityDataCache, activeUtility);
}

async function loadDashboard() {
  try {
    const [dashboardResponse, alertsResponse, summaryResponse] = await Promise.all([
      fetch("./data/dashboard_data.json"),
      fetch("./data/alerts.json"),
      fetch("./data/summary.json")
    ]);

    if (!dashboardResponse.ok || !alertsResponse.ok || !summaryResponse.ok) {
      throw new Error("Failed to load one or more JSON files.");
    }

    const dashboardData = await dashboardResponse.json();
    const alertsData = await alertsResponse.json();
    const summaryData = await summaryResponse.json();

    setupTabs();
    renderDashboard(dashboardData, alertsData, summaryData);
  } catch (error) {
    console.error("Dashboard load error:", error);
    document.body.innerHTML = `
      <div style="padding:24px;font-family:Arial,Helvetica,sans-serif;">
        <h2>Failed to load dashboard data</h2>
        <p>${error.message}</p>
        <p>Make sure the JSON files exist and you are opening the dashboard through a local server.</p>
      </div>
    `;
  }
}

loadDashboard();