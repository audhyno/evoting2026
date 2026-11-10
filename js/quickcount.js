/**
 * ============================================================================
 * E-VOTING OSIS SMAN 1 PONTIANAK - QUICK COUNT VISUALIZER ENGINE
 * File: js/quickcount.js
 * Developer: ZianBOT by zianxy
 * Deskripsi: Render Donut Chart SVG 4 Warna Sesuai Referensi (Paslon ? & Golput),
 *            Logo E-Voting di Tengah, & Rotasi Warna Anonim Setiap 5 Menit.
 * ============================================================================
 */

// Konstanta dimensi dan geometri SVG Donut Chart (viewBox 560 x 400)
const DONUT_CONFIG = {
  VIEW_WIDTH: 560,
  VIEW_HEIGHT: 400,
  CENTER_X: 280,
  CENTER_Y: 200,
  RADIUS: 110,                     // Radius tengah cincin donat (inner=74, outer=146)
  STROKE_WIDTH: 72,                // Ketebalan cincin donat sesuai referensi
  LABEL_RADIUS_X: 194,             // Jarak horizontal label luar dari titik pusat
  LABEL_RADIUS_Y: 174,             // Jarak vertikal label luar dari titik pusat
  POLL_INTERVAL_MS: 20000,         // Interval polling data (20 detik)
  COLOR_ROTATE_INTERVAL_MS: 300000 // Interval pengacakan warna anonim (5 menit = 300.000 ms)
};

// Keliling lingkaran: C = 2 * PI * R
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_CONFIG.RADIUS;

// Palet warna biru-es kontras sesuai desain referensi (diacak setiap 5 menit untuk anonimitas)
const ANONIM_COLOR_POOL = [
  '#3b73ac', // Steel Blue (Referensi Kanan)
  '#125b88', // Deep Ocean Blue (Referensi Bawah)
  '#1f97dc', // Cerulean Blue (Referensi Kiri Bawah)
  '#c6f1ff'  // Icy Light Cyan (Referensi Kiri Atas)
];

// State internal visualizer
let isQuickCountLoading = false;
let pollingIntervalInstance = null;
let colorRotationIntervalInstance = null;
let lastQuickCountData = null;
let activeColorMap = {};
let activePaslonOrder = [];
let activeDonutSegmentIndex = -1;

/**
 * Mengacak array menggunakan algoritma Fisher-Yates
 * @param {Array} arr - Array sumber
 * @returns {Array} Array baru yang sudah teracak
 */
function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Menghasilkan kombinasi warna acak baru dan urutan segmen acak
 * yang berubah setiap 5 menit demi menjaga kerahasiaan/anonimitas paslon.
 */
function randomizeQuickCountColors() {
  const shuffledColors = shuffleArray(ANONIM_COLOR_POOL);
  activeColorMap = {
    paslon_1: shuffledColors[0],
    paslon_2: shuffledColors[1],
    paslon_3: shuffledColors[2],
    belum_memilih: shuffledColors[3]
  };
  activePaslonOrder = shuffleArray(['paslon_1', 'paslon_2', 'paslon_3']);

  if (lastQuickCountData) {
    renderDonutChart(lastQuickCountData);
  }
}

/**
 * Inisialisasi awal modul Quick Count
 */
function initQuickCount() {
  randomizeQuickCountColors();
  refreshData();
  startAutoPolling();
  startColorRotationTimer();
}

/**
 * Memulai timer pengacakan warna diagram lingkaran setiap 5 menit
 */
function startColorRotationTimer() {
  if (colorRotationIntervalInstance) {
    clearInterval(colorRotationIntervalInstance);
  }
  colorRotationIntervalInstance = setInterval(function () {
    randomizeQuickCountColors();
  }, DONUT_CONFIG.COLOR_ROTATE_INTERVAL_MS);
}

/**
 * Mengambil data Quick Count terbaru dari VotingAPI dan merender antarmuka
 */
async function refreshData() {
  if (isQuickCountLoading) return;
  isQuickCountLoading = true;

  try {
    let result = null;
    if (window.VotingAPI && typeof window.VotingAPI.fetchQuickCountData === 'function') {
      result = await window.VotingAPI.fetchQuickCountData();
    }

    if (result && Array.isArray(result.segments)) {
      lastQuickCountData = result;
      renderDonutChart(result);
    } else {
      console.warn('[QuickCount] Format data respon tidak dikenali.');
    }
  } catch (error) {
    console.error('[QuickCount] Gagal memperbarui data:', error);
  } finally {
    isQuickCountLoading = false;
  }
}

/**
 * Merender Donut Chart SVG 4 Warna beserta label luar ("Paslon ?" dan "Golput")
 * persis seperti gambar referensi.
 * @param {Object} data - Objek rekap data quick count dari API
 */
function renderDonutChart(data) {
  const svgElement = document.getElementById('donutSvgChart');
  if (!svgElement) return;

  if (!activeColorMap || !activeColorMap.paslon_1) {
    randomizeQuickCountColors();
  }

  const rawSegments = data.segments || [];
  const paslonSegments = [];
  const otherSegments = [];

  rawSegments.forEach(function (seg, idx) {
    const segKey = seg.key || ('paslon_' + (idx + 1));
    const isBelum = (segKey === 'belum_memilih');
    const assignedColor = activeColorMap[segKey] || ANONIM_COLOR_POOL[idx % ANONIM_COLOR_POOL.length];
    const clonedSeg = Object.assign({}, seg, {
      key: segKey,
      color: assignedColor,
      isBelumMemilih: isBelum
    });

    if (isBelum) {
      otherSegments.push(clonedSeg);
    } else {
      paslonSegments.push(clonedSeg);
    }
  });

  // Urutkan segmen paslon berdasarkan urutan acak 5-menitan
  paslonSegments.sort(function (a, b) {
    return activePaslonOrder.indexOf(a.key) - activePaslonOrder.indexOf(b.key);
  });

  // Susun segmen searah jarum jam mulai dari atas (12 o'clock): 3 Paslon diikuti Golput
  const segments = paslonSegments.concat(otherSegments);

  // Hitung total persentase untuk normalisasi busur lingkaran penuh
  let totalPercent = 0;
  segments.forEach(function (seg) {
    totalPercent += Math.max(0, parseFloat(seg.persentase) || 0);
  });
  if (totalPercent <= 0) {
    totalPercent = 100;
  }

  let accumulatedRatio = 0;
  let circlesHtml = '';
  const labelItems = [];

  segments.forEach(function (segment, index) {
    const rawPct = Math.max(0, parseFloat(segment.persentase) || 0);
    const ratio = rawPct / totalPercent;
    const strokeDash = ratio * DONUT_CIRCUMFERENCE;
    const currentOffset = -(accumulatedRatio * DONUT_CIRCUMFERENCE);

    const isBelumMemilih = Boolean(segment.isBelumMemilih);
    const displayLabel = isBelumMemilih ? 'Golput' : 'Paslon ?';
    const formattedPct = Number(rawPct.toFixed(1)) + '%';

    circlesHtml += '<circle ';
    circlesHtml += '  class="donut-segment" ';
    circlesHtml += '  id="donut-segment-' + index + '" ';
    circlesHtml += '  cx="' + DONUT_CONFIG.CENTER_X + '" ';
    circlesHtml += '  cy="' + DONUT_CONFIG.CENTER_Y + '" ';
    circlesHtml += '  r="' + DONUT_CONFIG.RADIUS + '" ';
    circlesHtml += '  transform="rotate(-90 ' + DONUT_CONFIG.CENTER_X + ' ' + DONUT_CONFIG.CENTER_Y + ')" ';
    circlesHtml += '  stroke="' + segment.color + '" ';
    circlesHtml += '  stroke-dasharray="' + strokeDash.toFixed(2) + ' ' + DONUT_CIRCUMFERENCE.toFixed(2) + '" ';
    circlesHtml += '  stroke-dashoffset="' + currentOffset.toFixed(2) + '" ';
    circlesHtml += '  data-label="' + displayLabel + '" ';
    circlesHtml += '  data-percent="' + formattedPct + '" ';
    circlesHtml += '  role="button" ';
    circlesHtml += '  tabindex="0" ';
    circlesHtml += '  aria-label="' + displayLabel + ': ' + formattedPct + '" ';
    circlesHtml += '/>';

    if (rawPct > 0) {
      const midRatio = accumulatedRatio + (ratio / 2);
      // Sudut dalam radian (-PI/2 adalah titik 12 o'clock / atas)
      const angleRad = (midRatio * 2 * Math.PI) - (Math.PI / 2);
      labelItems.push({
        index: index,
        label: displayLabel,
        percentText: formattedPct,
        angle: angleRad,
        ratio: ratio
      });
    }

    accumulatedRatio += ratio;
  });

  // Hindari tabrakan posisi label luar jika ada segmen kecil yang berdekatan
  const minAngleGap = 0.36; // ~20 derajat
  for (let i = 1; i < labelItems.length; i++) {
    if (labelItems[i].angle - labelItems[i - 1].angle < minAngleGap) {
      labelItems[i].angle = labelItems[i - 1].angle + minAngleGap;
    }
  }

  let labelsHtml = '';
  labelItems.forEach(function (item) {
    const lx = DONUT_CONFIG.CENTER_X + Math.cos(item.angle) * DONUT_CONFIG.LABEL_RADIUS_X;
    const ly = DONUT_CONFIG.CENTER_Y + Math.sin(item.angle) * DONUT_CONFIG.LABEL_RADIUS_Y;

    labelsHtml += '<text class="qc-external-label" id="qc-label-' + item.index + '" x="' + lx.toFixed(1) + '" y="' + (ly - 7).toFixed(1) + '">';
    labelsHtml += '  <tspan x="' + lx.toFixed(1) + '" dy="0">' + item.label + '</tspan>';
    labelsHtml += '  <tspan x="' + lx.toFixed(1) + '" dy="20">' + item.percentText + '</tspan>';
    labelsHtml += '</text>';
  });

  svgElement.innerHTML = circlesHtml + labelsHtml;

  // Pasang interaksi sorotan segmen saat disentuh/hover
  attachDonutSegmentListeners(segments);
}

/**
 * Memasang event interaktif hover dan sentuhan (touch/click) pada segmen diagram donat
 * @param {Array} segments - Array data segmen
 */
function attachDonutSegmentListeners(segments) {
  const svgElement = document.getElementById('donutSvgChart');

  function highlightSegment(index) {
    activeDonutSegmentIndex = index;
    segments.forEach(function (_, i) {
      const circleEl = document.getElementById('donut-segment-' + i);
      const labelEl = document.getElementById('qc-label-' + i);
      if (circleEl) {
        if (i === index) {
          circleEl.classList.add('active-segment');
          circleEl.style.opacity = '1';
        } else {
          circleEl.classList.remove('active-segment');
          circleEl.style.opacity = '0.68';
        }
      }
      if (labelEl) {
        labelEl.style.opacity = (i === index) ? '1' : '0.65';
      }
    });
  }

  function resetToDefault() {
    activeDonutSegmentIndex = -1;
    segments.forEach(function (_, i) {
      const circleEl = document.getElementById('donut-segment-' + i);
      const labelEl = document.getElementById('qc-label-' + i);
      if (circleEl) {
        circleEl.classList.remove('active-segment');
        circleEl.style.opacity = '1';
      }
      if (labelEl) {
        labelEl.style.opacity = '1';
      }
    });
  }

  segments.forEach(function (_, index) {
    const circle = document.getElementById('donut-segment-' + index);
    if (!circle) return;

    circle.addEventListener('mouseenter', function () {
      highlightSegment(index);
    });

    circle.addEventListener('mouseleave', function () {
      resetToDefault();
    });

    circle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (activeDonutSegmentIndex === index) {
        resetToDefault();
      } else {
        highlightSegment(index);
      }
    });

    circle.addEventListener('touchstart', function (e) {
      e.stopPropagation();
      if (activeDonutSegmentIndex === index) {
        resetToDefault();
      } else {
        highlightSegment(index);
      }
    }, { passive: true });
  });

  if (svgElement) {
    document.addEventListener('click', function (e) {
      if (!svgElement.contains(e.target) && activeDonutSegmentIndex !== -1) {
        resetToDefault();
      }
    });
  }
}

/**
 * Memulai interval polling data berkala
 */
function startAutoPolling() {
  stopAutoPolling();
  pollingIntervalInstance = setInterval(function () {
    const homeView = document.getElementById('view-home');
    const isHomeVisible = homeView && homeView.classList.contains('active');
    if (isHomeVisible) {
      refreshData();
    }
  }, DONUT_CONFIG.POLL_INTERVAL_MS);
}

/**
 * Menghentikan interval polling
 */
function stopAutoPolling() {
  if (pollingIntervalInstance) {
    clearInterval(pollingIntervalInstance);
    pollingIntervalInstance = null;
  }
}

// Inisialisasi otomatis saat dokumen DOM siap
document.addEventListener('DOMContentLoaded', function () {
  initQuickCount();
});

// Ekspor modul QuickCountVisualizer ke window global
window.QuickCountVisualizer = {
  initQuickCount: initQuickCount,
  refreshData: refreshData,
  randomizeQuickCountColors: randomizeQuickCountColors,
  startAutoPolling: startAutoPolling,
  stopAutoPolling: stopAutoPolling
};
