/**
 * Aplicație pentru Analiza Cursului Valutar BNR
 * Proiect PAAI - Programarea Aplicațiilor Avansate pe Internet
 *
 * Funcționalități:
 * - Preluare date XML de la BNR
 * - Parsare și procesare date
 * - Vizualizare grafică cu Chart.js
 * - Filtrare și sortare date
 * - Export CSV
 */

// ===========================================
// CONSTANTE ȘI CONFIGURARE
// ===========================================
// Auto-detect: localhost uses public CORS proxy, production uses nginx proxy
const IS_LOCAL = window.location.hostname === "localhost" || 
                 window.location.hostname === "127.0.0.1" ||
                 window.location.protocol === "file:";

const BNR_URL = IS_LOCAL 
  ? "https://corsproxy.io/?https://www.bnr.ro/nbrfxrates.xml" 
  : "/api/bnr/nbrfxrates.xml";
const BNR_ARCHIVE_URL = IS_LOCAL 
  ? "https://corsproxy.io/?https://www.bnr.ro/files/xml/years/nbrfxrates" 
  : "/api/bnr/files/xml/years/nbrfxrates";
const CURRENCIES = ["EUR", "USD", "GBP"];

const CHART_COLORS = {
  EUR: { border: "#2563eb", background: "rgba(37, 99, 235, 0.1)" },
  USD: { border: "#22c55e", background: "rgba(34, 197, 94, 0.1)" },
  GBP: { border: "#f59e0b", background: "rgba(245, 158, 11, 0.1)" },
};

// ===========================================
// STATE MANAGEMENT
// ===========================================
let appState = {
  data: [],
  filteredData: [],
  selectedCurrencies: [...CURRENCIES],
  dateRange: { start: null, end: null },
  charts: { main: null, comparison: null },
  comparisonCurrencies: [...CURRENCIES],
};

// ===========================================
// DOM ELEMENTS
// ===========================================
const elements = {
  currencySelect: document.getElementById("currency-select"),
  dateStart: document.getElementById("date-start"),
  dateEnd: document.getElementById("date-end"),
  btnFetch: document.getElementById("btn-fetch"),
  btnExport: document.getElementById("btn-export"),
  statsCards: document.getElementById("stats-cards"),
  tableBody: document.getElementById("table-body"),
  tableSearch: document.getElementById("table-search"),
  tableSort: document.getElementById("table-sort"),
  loadingOverlay: document.getElementById("loading-overlay"),
  currencyChart: document.getElementById("currency-chart"),
  comparisonChart: document.getElementById("comparison-chart"),
  comparisonButtons: document.getElementById("comparison-currency-buttons"),
};

// ===========================================
// UTILITĂȚI
// ===========================================

/**
 * Afișează/ascunde overlay-ul de încărcare
 */
function showLoading(show = true) {
  elements.loadingOverlay.classList.toggle("hidden", !show);
}

/**
 * Formatează o dată în format românesc
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Formatează un număr cu 4 zecimale
 */
function formatNumber(num) {
  return parseFloat(num).toFixed(4);
}

/**
 * Calculează variația procentuală
 */
function calculateChange(current, previous) {
  if (!previous) return 0;
  return (((current - previous) / previous) * 100).toFixed(2);
}

/**
 * Generează culoare consistentă pentru valută
 */
function getRandomColor(currency) {
  const colors = ["#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16", "#06b6d4"];
  let hash = 0;
  for (let i = 0; i < currency.length; i++) {
    hash = currency.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ===========================================
// FUNCȚII PENTRU PRELUARE DATE
// ===========================================

/**
 * Preia date XML de la BNR
 * Folosește fetch API cu CORS proxy pentru demo
 */
async function fetchBNRData() {
  showLoading(true);

  try {
    // Pentru testare locală, folosim date simulate
    // În producție, s-ar folosi un proxy server sau date stocate
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1];

    let allData = [];

    // Încercăm să preluăm de la BNR (poate necesita proxy CORS)
    for (const year of years) {
      try {
        const url = `${BNR_ARCHIVE_URL}${year}.xml`;
        const response = await fetch(url);

        if (response.ok) {
          const xmlText = await response.text();
          const yearData = parseXMLData(xmlText);
          allData = [...allData, ...yearData];
        }
      } catch (err) {
        console.log(`Nu s-au putut prelua datele pentru ${year}:`, err);
      }
    }

    // Dacă nu avem date de la BNR, folosim date simulate pentru demo
    if (allData.length === 0) {
      console.log("Se folosesc date simulate pentru demonstrație");
      allData = generateSimulatedData();
    }

    // Sortăm după dată
    allData.sort((a, b) => new Date(a.date) - new Date(b.date));

    appState.data = allData;
    applyFilters();
  } catch (error) {
    console.error("Eroare la preluarea datelor:", error);
    alert("Nu s-au putut prelua datele. Se folosesc date simulate.");
    appState.data = generateSimulatedData();
    applyFilters();
  } finally {
    showLoading(false);
  }
}

/**
 * Parsează XML-ul BNR și extrage cursurile valutare
 */
function parseXMLData(xmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const data = [];
  const cubes = xmlDoc.querySelectorAll("Cube");

  cubes.forEach((cube) => {
    const date = cube.getAttribute("date");
    if (!date) return;

    const rates = cube.querySelectorAll("Rate");
    rates.forEach((rate) => {
      const currency = rate.getAttribute("currency");
      if (CURRENCIES.includes(currency)) {
        const multiplier = parseInt(rate.getAttribute("multiplier")) || 1;
        const value = parseFloat(rate.textContent) / multiplier;

        data.push({
          date: date,
          currency: currency,
          value: value,
        });
      }
    });
  });

  return data;
}

/**
 * Generează date simulate pentru demonstrație
 */
function generateSimulatedData() {
  const data = [];
  const baseRates = { EUR: 4.97, USD: 4.55, GBP: 5.78 };
  const volatility = { EUR: 0.02, USD: 0.03, GBP: 0.04 };

  // Generăm date pentru ultimele 365 de zile
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 365);

  let currentRates = { ...baseRates };

  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    // Sărim weekend-urile
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const dateStr = d.toISOString().split("T")[0];

    CURRENCIES.forEach((currency) => {
      // Simulăm fluctuații de piață
      const change = (Math.random() - 0.5) * volatility[currency];
      currentRates[currency] = currentRates[currency] * (1 + change);

      // Ținem cursul în limite rezonabile
      currentRates[currency] = Math.max(baseRates[currency] * 0.9, Math.min(baseRates[currency] * 1.1, currentRates[currency]));

      data.push({
        date: dateStr,
        currency: currency,
        value: currentRates[currency],
      });
    });
  }

  return data;
}

// ===========================================
// FUNCȚII PENTRU FILTRARE ȘI PROCESARE
// ===========================================

/**
 * Aplică filtrele selectate și actualizează vizualizările
 */
function applyFilters() {
  const selectedOptions = Array.from(elements.currencySelect.selectedOptions);
  appState.selectedCurrencies = selectedOptions.map((opt) => opt.value);

  const startDate = elements.dateStart.value;
  const endDate = elements.dateEnd.value;

  appState.filteredData = appState.data.filter((item) => {
    // Filtru valută
    if (!appState.selectedCurrencies.includes(item.currency)) return false;

    // Filtru dată
    if (startDate && item.date < startDate) return false;
    if (endDate && item.date > endDate) return false;

    return true;
  });

  // Actualizăm toate vizualizările
  updateStatistics();
  updateChart();
  updateTable();
  updateComparisonChart();
}

/**
 * Calculează și afișează statisticile
 */
function updateStatistics() {
  let statsHTML = "";

  appState.selectedCurrencies.forEach((currency) => {
    const currencyData = appState.filteredData.filter((d) => d.currency === currency).sort((a, b) => new Date(a.date) - new Date(b.date));

    if (currencyData.length === 0) return;

    const values = currencyData.map((d) => d.value);
    const latest = currencyData[currencyData.length - 1];
    const previous = currencyData[currencyData.length - 2];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const change = previous ? calculateChange(latest.value, previous.value) : 0;

    const changeClass = change >= 0 ? "positive" : "negative";
    const changeIcon = change >= 0 ? "↑" : "↓";

    statsHTML += `
            <div class="stat-card">
                <h3>${currency} - Ultima valoare</h3>
                <div class="value">${formatNumber(latest.value)} RON</div>
                <div class="change ${changeClass}">${changeIcon} ${Math.abs(change)}%</div>
            </div>
            <div class="stat-card">
                <h3>${currency} - Minim</h3>
                <div class="value">${formatNumber(min)} RON</div>
            </div>
            <div class="stat-card">
                <h3>${currency} - Maxim</h3>
                <div class="value">${formatNumber(max)} RON</div>
            </div>
            <div class="stat-card">
                <h3>${currency} - Media</h3>
                <div class="value">${formatNumber(avg)} RON</div>
            </div>
        `;
  });

  elements.statsCards.innerHTML = statsHTML || "<p>Nu există date pentru afișare.</p>";
}

// ===========================================
// FUNCȚII PENTRU GRAFICE
// ===========================================

/**
 * Actualizează graficul principal cu evoluția cursurilor
 */
function updateChart() {
  const ctx = elements.currencyChart.getContext("2d");

  // Distrugem graficul existent
  if (appState.charts.main) {
    appState.charts.main.destroy();
  }

  // Pregătim datele pentru grafic
  const datasets = appState.selectedCurrencies.map((currency) => {
    const currencyData = appState.filteredData.filter((d) => d.currency === currency).sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      label: currency,
      data: currencyData.map((d) => ({ x: d.date, y: d.value })),
      borderColor: CHART_COLORS[currency].border,
      backgroundColor: CHART_COLORS[currency].background,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 5,
    };
  });

  appState.charts.main = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          callbacks: {
            title: (items) => formatDate(items[0].raw.x),
            label: (item) => `${item.dataset.label}: ${formatNumber(item.raw.y)} RON`,
          },
        },
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "month",
            displayFormats: {
              month: "MMM yyyy",
            },
          },
          title: {
            display: true,
            text: "Data",
          },
        },
        y: {
          title: {
            display: true,
            text: "Curs (RON)",
          },
        },
      },
    },
  });
}

/**
 * Actualizează graficul de comparație
 */
function updateComparisonChart() {
  const ctx = elements.comparisonChart.getContext("2d");

  if (appState.charts.comparison) {
    appState.charts.comparison.destroy();
  }

  // Folosim datele complete, filtrate doar după interval de date (independent de selectia principală)
  const startDate = elements.dateStart.value;
  const endDate = elements.dateEnd.value;

  const datasets = appState.comparisonCurrencies
    .map((currency) => {
      // Filtrăm datele doar după dată, nu după valutele selectate sus
      let currencyData = appState.data
        .filter((d) => d.currency === currency)
        .filter((d) => {
          if (startDate && d.date < startDate) return false;
          if (endDate && d.date > endDate) return false;
          return true;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      if (currencyData.length === 0) return null;

      const baseValue = currencyData[0].value;

      return {
        label: `${currency} (variație %)`,
        data: currencyData.map((d) => ({
          x: d.date,
          y: (((d.value - baseValue) / baseValue) * 100).toFixed(2),
        })),
        borderColor: CHART_COLORS[currency]?.border || getRandomColor(currency),
        backgroundColor: "transparent",
        tension: 0.4,
        pointRadius: 0,
      };
    })
    .filter(Boolean);

  appState.charts.comparison = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
        },
        tooltip: {
          callbacks: {
            title: (items) => formatDate(items[0].raw.x),
            label: (item) => `${item.dataset.label}: ${item.raw.y}%`,
          },
        },
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "month",
          },
          title: {
            display: true,
            text: "Data",
          },
        },
        y: {
          title: {
            display: true,
            text: "Variație (%)",
          },
        },
      },
    },
  });
}

// ===========================================
// FUNCȚII PENTRU TABEL
// ===========================================

/**
 * Actualizează tabelul cu datele filtrate
 */
function updateTable() {
  const searchTerm = elements.tableSearch.value.toLowerCase();
  const sortBy = elements.tableSort.value;

  // Filtrăm după căutare
  let tableData = appState.filteredData.filter((item) => {
    return item.currency.toLowerCase().includes(searchTerm) || item.date.includes(searchTerm) || formatNumber(item.value).includes(searchTerm);
  });

  // Adăugăm variația pentru fiecare înregistrare
  tableData = tableData.map((item, index, arr) => {
    const prevItem = arr.find((d) => d.currency === item.currency && d.date < item.date);
    const previousItems = arr.filter((d) => d.currency === item.currency && d.date < item.date).sort((a, b) => new Date(b.date) - new Date(a.date));

    const previous = previousItems[0];

    return {
      ...item,
      change: previous ? calculateChange(item.value, previous.value) : 0,
    };
  });

  // Sortăm
  tableData.sort((a, b) => {
    switch (sortBy) {
      case "date-desc":
        return new Date(b.date) - new Date(a.date);
      case "date-asc":
        return new Date(a.date) - new Date(b.date);
      case "value-desc":
        return b.value - a.value;
      case "value-asc":
        return a.value - b.value;
      default:
        return 0;
    }
  });

  // Limităm la 100 de înregistrări pentru performanță
  const limitedData = tableData.slice(0, 100);

  // Generăm HTML-ul tabelului
  elements.tableBody.innerHTML = limitedData
    .map((item) => {
      const changeClass = item.change >= 0 ? "change-positive" : "change-negative";
      const changeIcon = item.change >= 0 ? "↑" : "↓";

      return `
            <tr>
                <td>${formatDate(item.date)}</td>
                <td><span class="currency-badge ${item.currency}">${item.currency}</span></td>
                <td>${formatNumber(item.value)}</td>
                <td class="${changeClass}">${changeIcon} ${Math.abs(item.change)}%</td>
            </tr>
        `;
    })
    .join("");

  if (limitedData.length === 0) {
    elements.tableBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center;">Nu există date pentru afișare.</td>
            </tr>
        `;
  }
}

// ===========================================
// FUNCȚII PENTRU EXPORT
// ===========================================

/**
 * Exportă datele filtrate în format CSV
 */
function exportCSV() {
  if (appState.filteredData.length === 0) {
    alert("Nu există date pentru export!");
    return;
  }

  // Header CSV
  let csv = "Data,Valuta,Curs (RON)\n";

  // Adăugăm datele
  appState.filteredData.forEach((item) => {
    csv += `${item.date},${item.currency},${formatNumber(item.value)}\n`;
  });

  // Creăm și descărcăm fișierul
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `cursuri_valutare_${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ===========================================
// EVENT LISTENERS
// ===========================================

/**
 * Inițializează event listeners
 */
function initEventListeners() {
  // Buton încărcare date
  elements.btnFetch.addEventListener("click", fetchBNRData);

  // Buton export
  elements.btnExport.addEventListener("click", exportCSV);

  // Filtre
  elements.currencySelect.addEventListener("change", applyFilters);
  elements.dateStart.addEventListener("change", applyFilters);
  elements.dateEnd.addEventListener("change", applyFilters);

  // Căutare în tabel
  elements.tableSearch.addEventListener("input", updateTable);

  // Sortare tabel
  elements.tableSort.addEventListener("change", updateTable);

  // Click pe header-ul tabelului pentru sortare
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const sortType = th.dataset.sort;
      if (sortType === "date") {
        elements.tableSort.value = elements.tableSort.value === "date-desc" ? "date-asc" : "date-desc";
      } else if (sortType === "value") {
        elements.tableSort.value = elements.tableSort.value === "value-desc" ? "value-asc" : "value-desc";
      }
      updateTable();
    });
  });

  // Butoane pentru comparație valute
  initComparisonButtons();
}

/**
 * Inițializează butoanele de comparație valute
 */
function initComparisonButtons() {
  elements.comparisonButtons.querySelectorAll(".currency-btn").forEach((btn) => {
    btn.addEventListener("click", () => toggleComparisonCurrency(btn));
  });
}

/**
 * Toggle selecție valută pentru comparație
 */
function toggleComparisonCurrency(btn) {
  const currency = btn.dataset.currency;
  btn.classList.toggle("active");

  if (btn.classList.contains("active")) {
    if (!appState.comparisonCurrencies.includes(currency)) {
      appState.comparisonCurrencies.push(currency);
    }
  } else {
    appState.comparisonCurrencies = appState.comparisonCurrencies.filter((c) => c !== currency);
  }

  updateComparisonChart();
}

/**
 * Inițializează datele implicite
 */
function initDefaults() {
  // Setăm intervalul de date implicit (ultima lună)
  const today = new Date();
  const oneMonthAgo = new Date(today);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  elements.dateStart.value = oneMonthAgo.toISOString().split("T")[0];
  elements.dateEnd.value = today.toISOString().split("T")[0];
}

// ===========================================
// INIȚIALIZARE APLICAȚIE
// ===========================================

/**
 * Funcția principală de inițializare
 */
async function init() {
  console.log("🚀 Inițializare aplicație Analiza Cursului Valutar BNR");

  initDefaults();
  initEventListeners();

  // Încărcăm datele automat la pornire
  await fetchBNRData();

  console.log("✅ Aplicație inițializată cu succes!");
}

// Pornim aplicația când DOM-ul este gata
document.addEventListener("DOMContentLoaded", init);
