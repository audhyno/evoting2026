/**
 * ============================================================================
 * E-VOTING OSIS SMAN 1 PONTIANAK - QUICK COUNT VISUALIZER ENGINE
 * File: js/quickcount.js
 * Developer: ZianBOT by zianxy
 * Deskripsi: Render Donut Chart SVG 4 Warna (P1, P2, P3, Belum Memilih),
 *            Kalkulasi busur lingkaran anonim, & sinkronisasi data DPT.
 * ============================================================================
 */

// Konstanta dimensi dan geometri SVG Donut Chart
const DONUT_CONFIG = {
  VIEW_SIZE: 220,                  // Dimensi viewBox (220 x 220)
  CENTER_COORD: 110,               // Koordinat titik tengah (cx, cy)
  RADIUS: 86,                      // Radius lingkaran donut (ruang tengah lebih lega)
  STROKE_WIDTH: 22,                // Ketebalan segmen donat
  POLL_INTERVAL_MS: 20000,         // Interval polling data (20 detik)
  COLOR_ROTATE_INTERVAL_MS: 300000 // Interval pengacakan warna anonim (5 menit = 300.000 ms)
};

// Keliling lingkaran: C = 2 * PI * R (2 * 3.14159265 * 70 ≈ 439.82)
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_CONFIG.RADIUS;

// Koleksi warna cerah kontras tinggi untuk pengacakan otomatis setiap 5 menit
const ANONIM_COLOR_POOL = [
  '#ec4899', // Pink Magenta
  '#8b5cf6', // Violet Ungu
  '#10b981', // Hijau Emerald
  '#f59e0b', // Kuning Amber
  '#ef4444', // Merah Coral
  '#06b6d4', // Cyan Turquoise
  '#f97316', // Oranye Terang
  '#a855f7', // Ungu Elektrik
  '#22c55e', // Hijau Neon
  '#eab308', // Emas Cerah
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#f43f5e', // Rose
  '#84cc16', // Lime
  '#38bdf8'  // Sky Cerah
];

// State internal visualizer
let isQuickCountLoading = false;
let pollingIntervalInstance = null;
let colorRotationIntervalInstance = null;
let lastQuickCountData = null;
let activeColorMap = {};
let activePaslonOrder = [];

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
      renderLegend(result);
      updateSummaryMetrics(result);
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
 * Merender segmen Donut Chart SVG 4 Warna dengan warna acak yang berganti setiap 5 menit
 * @param {Object} data - Objek rekap data quick count dari API
 */
function renderDonutChart(data) {
  const svgElement = document.getElementById('donutSvgChart');
  const percentLabel = document.getElementById('donutCenterPercent');
  const subtitleLabel = document.getElementById('donutCenterSubtitle');

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

  // Urutkan segmen paslon berdasarkan urutan acak 5-menitan agar posisi busur juga anonim
  paslonSegments.sort(function (a, b) {
    return activePaslonOrder.indexOf(a.key) - activePaslonOrder.indexOf(b.key);
  });

  const segments = paslonSegments.concat(otherSegments);
  let accumulatedOffset = 0;
  let svgContent = '';

  // Bangun elemen circle SVG untuk setiap segmen warna
  segments.forEach(function (segment, index) {
    const percentage = Math.max(0, parseFloat(segment.persentase) || 0);
    const strokeDash = (percentage / 100) * DONUT_CIRCUMFERENCE;
    const currentOffset = -accumulatedOffset;

    const isBelumMemilih = Boolean(segment.isBelumMemilih);
    const displayLabel = isBelumMemilih ? 'Belum Memilih' : 'Anonim';

    let segmentHtml = '';
    segmentHtml += '<circle ';
    segmentHtml += '  class="donut-segment" ';
    segmentHtml += '  id="donut-segment-' + index + '" ';
    segmentHtml += '  cx="' + DONUT_CONFIG.CENTER_COORD + '" ';
    segmentHtml += '  cy="' + DONUT_CONFIG.CENTER_COORD + '" ';
    segmentHtml += '  r="' + DONUT_CONFIG.RADIUS + '" ';
    segmentHtml += '  stroke="' + segment.color + '" ';
    segmentHtml += '  stroke-dasharray="' + strokeDash.toFixed(2) + ' ' + DONUT_CIRCUMFERENCE.toFixed(2) + '" ';
    segmentHtml += '  stroke-dashoffset="' + currentOffset.toFixed(2) + '" ';
    segmentHtml += '  data-label="' + displayLabel + '" ';
    segmentHtml += '  data-percent="' + percentage.toFixed(1) + '%" ';
    segmentHtml += '  data-is-belum="' + (isBelumMemilih ? 'true' : 'false') + '" ';
    segmentHtml += '  role="button" ';
    segmentHtml += '  tabindex="0" ';
    segmentHtml += '  aria-label="' + displayLabel + ': ' + percentage.toFixed(1) + '%" ';
    segmentHtml += '/>';

    svgContent += segmentHtml;
    accumulatedOffset += strokeDash;
  });

  svgElement.innerHTML = svgContent;

  // Pasang listener interaksi kursor & sentuhan
  attachDonutSegmentListeners(segments);

  // Tampilkan persentase partisipasi di lingkaran tengah sebagai default
  if (percentLabel) {
    percentLabel.textContent = (data.persentase_partisipasi || 0) + '%';
  }
  if (subtitleLabel) {
    subtitleLabel.textContent = 'Partisipasi';
    subtitleLabel.style.color = '#ffffff';
    subtitleLabel.style.borderColor = 'rgba(255, 255, 255, 0.35)';
  }
}

let activeDonutSegmentIndex = -1;

/**
 * Memasang event interaktif hover dan sentuhan (touch/click) pada segmen diagram donat:
 * - Warna Paslon -> Keterangan: "Anonim"
 * - Segmen Belum Memilih -> Keterangan: "Belum Memilih"
 * - Default saat dilepas -> "Partisipasi"
 * @param {Array} segments - Array data segmen
 */
function attachDonutSegmentListeners(segments) {
  const percentLabel = document.getElementById('donutCenterPercent');
  const subtitleLabel = document.getElementById('donutCenterSubtitle');
  const svgElement = document.getElementById('donutSvgChart');

  function showSegmentDetails(seg, index) {
    activeDonutSegmentIndex = index;
    const isBelumMemilih = Boolean(seg.isBelumMemilih || seg.key === 'belum_memilih');
    const labelText = isBelumMemilih ? 'Belum Memilih' : 'Anonim';

    if (percentLabel) {
      percentLabel.textContent = (seg.persentase || 0) + '%';
    }
    if (subtitleLabel) {
      subtitleLabel.textContent = labelText;
      subtitleLabel.style.color = '#ffffff';
      subtitleLabel.style.borderColor = seg.color;
    }

    // Sorot segmen aktif dan redupkan segmen lainnya
    segments.forEach(function (_, i) {
      const circleEl = document.getElementById('donut-segment-' + i);
      if (circleEl) {
        if (i === index) {
          circleEl.classList.add('active-segment');
          circleEl.style.opacity = '1';
        } else {
          circleEl.classList.remove('active-segment');
          circleEl.style.opacity = '0.55';
        }
      }
    });
  }

  function resetToDefault() {
    activeDonutSegmentIndex = -1;
    if (lastQuickCountData) {
      if (percentLabel) {
        percentLabel.textContent = (lastQuickCountData.persentase_partisipasi || 0) + '%';
      }
      if (subtitleLabel) {
        subtitleLabel.textContent = 'Partisipasi';
        subtitleLabel.style.color = '#ffffff';
        subtitleLabel.style.borderColor = 'rgba(255, 255, 255, 0.35)';
      }
    }
    segments.forEach(function (_, i) {
      const circleEl = document.getElementById('donut-segment-' + i);
      if (circleEl) {
        circleEl.classList.remove('active-segment');
        circleEl.style.opacity = '1';
      }
    });
  }

  segments.forEach(function (seg, index) {
    const circle = document.getElementById('donut-segment-' + index);
    if (!circle) return;

    // Hover Desktop
    circle.addEventListener('mouseenter', function () {
      showSegmentDetails(seg, index);
    });

    circle.addEventListener('mouseleave', function () {
      resetToDefault();
    });

    // Touch / Click (Tablet, HP, Desktop Click)
    circle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (activeDonutSegmentIndex === index) {
        resetToDefault();
      } else {
        showSegmentDetails(seg, index);
      }
    });

    circle.addEventListener('touchstart', function (e) {
      e.stopPropagation();
      if (activeDonutSegmentIndex === index) {
        resetToDefault();
      } else {
        showSegmentDetails(seg, index);
      }
    }, { passive: true });
  });

  // Tap di luar diagram mengembalikan ke tampilan Partisipasi
  if (svgElement) {
    document.addEventListener('click', function (e) {
      if (!svgElement.contains(e.target) && activeDonutSegmentIndex !== -1) {
        resetToDefault();
      }
    });
  }
}

/**
 * Legenda luar ditiadakan sesuai preferensi tampilan diagram pie murni anonim
 * @param {Object} data - Objek rekap data quick count
 */
function renderLegend(data) {
  const container = document.getElementById('qcLegendGrid');
  if (container) {
    container.innerHTML = '';
    container.style.display = 'none';
  }
}

/**
 * Memperbarui teks waktu rekam sinkronisasi
 * @param {Object} data - Data quick count
 */
function updateSummaryMetrics(data) {
  const elTimestamp = document.getElementById('qcLastUpdated');

  if (elTimestamp && data.updated_at) {
    elTimestamp.textContent = 'Pembaruan: ' + data.updated_at + ' WIB';
  }
}

/**
 * Memberikan efek visual sorotan pada kartu legenda tertentu
 * @param {string} segmentKey - Key unik segmen
 */
function highlightLegendItem(segmentKey) {
  resetLegendHighlights();
  const target = document.getElementById('legend-' + segmentKey);
  if (target) {
    target.style.borderColor = '#ffffff';
    target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    target.style.transform = 'scale(1.03)';
    target.style.transition = 'all 0.2s ease';
  }
}

/**
 * Menghilangkan efek sorotan dari semua kartu legenda
 */
function resetLegendHighlights() {
  const allItems = document.querySelectorAll('.qc-legend-item');
  allItems.forEach(function (item) {
    item.style.borderColor = 'rgba(255, 255, 255, 0.22)';
    item.style.backgroundColor = 'rgba(0, 20, 50, 0.16)';
    item.style.transform = 'none';
  });
}

/**
 * Memulai interval polling data berkala
 */
function startAutoPolling() {
  stopAutoPolling();
  pollingIntervalInstance = setInterval(function () {
    // Hanya lakukan refresh jika halaman beranda sedang tampak
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
