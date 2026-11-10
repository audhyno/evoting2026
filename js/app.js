/**
 * ============================================================================
 * E-VOTING OSIS SMAN 1 PONTIANAK - MASTER SPA CONTROLLER & VIEW ROUTER
 * File: js/app.js
 * Developer: ZianBOT by zianxy
 * Deskripsi: State machine SPA view router, scroll snap controller,
 *            auto-stop YouTube player saat pindah section, & modal engine.
 * ============================================================================
 */

// Konstanta identifier tampilan SPA
const SPA_VIEWS = {
  HOME: 'view-home',
  BILIK: 'view-bilik',
  SELESAI: 'view-selesai'
};

// Variabel status internal aplikasi
let currentActiveView = SPA_VIEWS.HOME;
let currentActiveSectionIndex = 0;
let currentActiveOrasiIndex = 0;
let sectionObserverInstance = null;
let cachedPaslonList = [];
let cachedGaleriList = [];
let currentActiveGaleriPage = 0;
let totalGaleriPages = 1;
let currentVisiModalIndex = 0;

let currentFocusedPaslonIndex = null;

/**
 * Memformat string Visi & Misi menjadi HTML berstruktur rapi
 */
function formatVisiMisiHtml(text) {
  if (!text) return '<p class="visi-desc">Visi dan misi belum tersedia.</p>';

  let visiPart = '';
  let misiPart = '';

  const visiMatch = text.match(/Visi\s*:\s*([^]+?)(?=\s*Misi\s*:|$)/i);
  const misiMatch = text.match(/Misi\s*:\s*([^]+)$/i);

  if (visiMatch && visiMatch[1]) {
    visiPart = visiMatch[1].trim();
  }
  if (misiMatch && misiMatch[1]) {
    misiPart = misiMatch[1].trim();
  }

  if (!visiPart && !misiPart) {
    return '<div class="visi-block"><p class="visi-desc">' + text.replace(/\n/g, '<br>') + '</p></div>';
  }

  let html = '';
  if (visiPart) {
    html += '<div class="visi-block">';
    html += '  <h4 class="block-title"><span class="title-sparkle">&#10022;</span> VISI</h4>';
    html += '  <p class="visi-desc">"' + visiPart + '"</p>';
    html += '</div>';
  }

  if (misiPart) {
    html += '<div class="misi-block">';
    html += '  <h4 class="block-title"><span class="title-sparkle">&#10022;</span> MISI</h4>';
    const items = misiPart.split(/(?:;|\n|,\s*(?=[A-Z0-9]))+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
    if (items.length > 1) {
      html += '  <ul class="misi-list">';
      items.forEach(function (item, i) {
        html += '    <li><span class="misi-num">' + (i + 1) + '.</span> <span class="misi-desc">' + item.replace(/\.$/, '') + '</span></li>';
      });
      html += '  </ul>';
    } else {
      html += '  <p class="misi-desc">' + misiPart + '</p>';
    }
    html += '</div>';
  }

  return html;
}

/**
 * Memilih Paslon untuk ekspansi inline:
 * Paslon terpilih tetap di kiri, paslon lainnya tergeser ke dock samping,
 * dan panel Visi & Misi otomatis muncul di sebelahnya.
 * Jika sebelumnya sedang memutar video orasi paslon lain, video otomatis tertutup.
 */
function selectHomeCandidate(activeIdx) {
  if (!cachedPaslonList || cachedPaslonList.length === 0) return;

  // Tutup/hentikan semua video YouTube saat beralih ke paslon lain
  stopAllYouTubeVideos();

  currentFocusedPaslonIndex = activeIdx;
  const grid = document.getElementById('homeCandidatesGrid');
  const detailContainer = document.getElementById('inlineDetailContainer');

  if (!grid || !detailContainer) return;

  const activePaslon = cachedPaslonList[activeIdx];
  if (!activePaslon) return;

  grid.style.display = 'none';
  detailContainer.style.display = 'flex';

  const noUrut = (activePaslon.nomor_urut < 10 ? '0' : '') + activePaslon.nomor_urut;
  const label = activePaslon.label_paslon || ('PASLON ' + activePaslon.nomor_urut);
  const nama = activePaslon.nama_paslon || 'Calon Ketua & Wakil Ketua';
  const slogan = activePaslon.slogan || '';
  const foto = (window.VotingAPI && typeof window.VotingAPI.formatImageUrl === 'function')
    ? window.VotingAPI.formatImageUrl(activePaslon.foto_url)
    : activePaslon.foto_url;

  // 1. Kolom Kiri: Kartu Paslon Aktif Terfokus
  let leftHtml = '';
  leftHtml += '<div class="inline-active-card">';
  leftHtml += '  <div class="photo-frame">';
  leftHtml += '    <span class="badge-no-urut">' + noUrut + '</span>';
  leftHtml += '    <img src="' + foto + '" alt="' + label + '" referrerpolicy="no-referrer">';
  leftHtml += '  </div>';
  leftHtml += '  <div style="width: 100%;">';
  leftHtml += '    <h3 class="card-label">' + label + '</h3>';
  leftHtml += '    <p class="card-names">' + nama + '</p>';
  if (slogan) {
    leftHtml += '    <p class="card-slogan">"' + slogan + '"</p>';
  }
  leftHtml += '    <button type="button" class="card-btn-close" onclick="window.App.closeHomeCandidateDetail()">⮌ Kembali</button>';
  leftHtml += '  </div>';
  leftHtml += '</div>';

  // 2. Kolom Tengah: Panel Visi & Misi Paslon Aktif (2 Header: Visi & Misi dan Video Orasi)
  let centerHtml = '';
  centerHtml += '<div class="inline-visi-panel" id="inlineCenterPanel">';
  centerHtml += '  <div class="visi-panel-header" role="tablist">';
  centerHtml += '    <button type="button" class="visi-header-tab active" id="inlineTabVisi" role="tab" aria-selected="true" onclick="window.App.showInlineVisiMisi(' + activeIdx + ')">';
  centerHtml += '      <span class="title-sparkle">&#10022;</span>';
  centerHtml += '      <span>VISI &amp; MISI</span>';
  centerHtml += '    </button>';
  centerHtml += '    <button type="button" class="visi-header-tab" id="inlineTabOrasi" role="tab" aria-selected="false" onclick="window.App.showInlineOrasiVideo(' + activeIdx + ')">';
  centerHtml += '      <span class="title-sparkle">&#9654;</span>';
  centerHtml += '      <span>VIDEO ORASI</span>';
  centerHtml += '    </button>';
  centerHtml += '  </div>';
  centerHtml += '  <div class="visi-panel-body" id="inlinePanelBody">';
  centerHtml += formatVisiMisiHtml(activePaslon.visi_misi);
  centerHtml += '  </div>';
  centerHtml += '</div>';

  // 3. Kolom Kanan: Dock Paslon Lainnya yang Bergeser
  let rightHtml = '';
  rightHtml += '<div class="inline-dock">';
  rightHtml += '  <div class="dock-header">PASLON LAIN</div>';

  cachedPaslonList.forEach(function (otherPaslon, oIdx) {
    if (oIdx === activeIdx) return;

    const oNoUrut = (otherPaslon.nomor_urut < 10 ? '0' : '') + otherPaslon.nomor_urut;
    const oLabel = otherPaslon.label_paslon || ('PASLON ' + otherPaslon.nomor_urut);
    const oNama = otherPaslon.nama_paslon || '';
    const oFoto = (window.VotingAPI && typeof window.VotingAPI.formatImageUrl === 'function')
      ? window.VotingAPI.formatImageUrl(otherPaslon.foto_url)
      : otherPaslon.foto_url;

    rightHtml += '<div class="dock-card" onclick="window.App.selectHomeCandidate(' + oIdx + ')" title="Beralih ke ' + oLabel + '">';
    rightHtml += '  <div class="dock-photo">';
    rightHtml += '    <span class="dock-badge">' + oNoUrut + '</span>';
    rightHtml += '    <img src="' + oFoto + '" alt="' + oLabel + '" referrerpolicy="no-referrer">';
    rightHtml += '  </div>';
    rightHtml += '  <div class="dock-label">' + oLabel + '</div>';
    rightHtml += '  <div class="dock-names">' + oNama + '</div>';
    rightHtml += '  <div class="dock-action-hint">Beralih →</div>';
    rightHtml += '</div>';
  });

  rightHtml += '</div>';

  detailContainer.innerHTML = leftHtml + centerHtml + rightHtml;
}

/**
 * Mengubah tabel Visi & Misi secara langsung menjadi pemutar Video Orasi YouTube paslon terkait
 * dengan animasi transisi yang mulus.
 * @param {number} activeIdx - Indeks paslon aktif
 */
function showInlineOrasiVideo(activeIdx) {
  if (!cachedPaslonList || !cachedPaslonList[activeIdx]) return;

  stopAllYouTubeVideos();

  const activePaslon = cachedPaslonList[activeIdx];
  const label = activePaslon.label_paslon || ('PASLON ' + activePaslon.nomor_urut);
  const videoId = ORASI_VIDEO_IDS[activeIdx] || activePaslon.youtube_video_id || 'pD5AaON3dBE';

  const tabVisi = document.getElementById('inlineTabVisi');
  const tabOrasi = document.getElementById('inlineTabOrasi');
  const bodyEl = document.getElementById('inlinePanelBody');

  if (tabVisi) {
    tabVisi.classList.remove('active');
    tabVisi.setAttribute('aria-selected', 'false');
  }
  if (tabOrasi) {
    tabOrasi.classList.add('active');
    tabOrasi.setAttribute('aria-selected', 'true');
  }

  if (bodyEl) {
    bodyEl.classList.remove('video-mode');
    // Trigger reflow agar animasi smoothPanelContentSwap berputar ulang dengan halus
    void bodyEl.offsetWidth;
    bodyEl.classList.add('video-mode');
    bodyEl.innerHTML =
      '<div class="inline-orasi-video-frame">' +
      '  <iframe ' +
      '    id="inlineOrasiIframe" ' +
      '    src="https://www.youtube-nocookie.com/embed/' + videoId + '?enablejsapi=1&controls=1&rel=0&autoplay=1" ' +
      '    title="Orasi ' + label + '" ' +
      '    referrerpolicy="strict-origin-when-cross-origin" ' +
      '    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
      '    allowfullscreen>' +
      '  </iframe>' +
      '</div>';
  }
}

/**
 * Mengembalikan tampilan panel tengah dari Video Orasi kembali ke tabel Visi & Misi
 * serta menutup pemutar video YouTube.
 * @param {number} activeIdx - Indeks paslon aktif
 */
function showInlineVisiMisi(activeIdx) {
  if (!cachedPaslonList || !cachedPaslonList[activeIdx]) return;

  stopAllYouTubeVideos();

  const activePaslon = cachedPaslonList[activeIdx];

  const tabVisi = document.getElementById('inlineTabVisi');
  const tabOrasi = document.getElementById('inlineTabOrasi');
  const bodyEl = document.getElementById('inlinePanelBody');

  if (tabVisi) {
    tabVisi.classList.add('active');
    tabVisi.setAttribute('aria-selected', 'true');
  }
  if (tabOrasi) {
    tabOrasi.classList.remove('active');
    tabOrasi.setAttribute('aria-selected', 'false');
  }

  if (bodyEl) {
    bodyEl.classList.remove('video-mode');
    void bodyEl.offsetWidth;
    bodyEl.innerHTML = formatVisiMisiHtml(activePaslon.visi_misi);
  }
}

/**
 * Menutup tampilan inline detail, menghentikan video, dan mengembalikan 3 kartu paslon berdampingan
 */
function closeHomeCandidateDetail() {
  stopAllYouTubeVideos();
  currentFocusedPaslonIndex = null;
  const grid = document.getElementById('homeCandidatesGrid');
  const detailContainer = document.getElementById('inlineDetailContainer');

  if (grid) grid.style.display = 'grid';
  if (detailContainer) {
    detailContainer.style.display = 'none';
    detailContainer.innerHTML = '';
  }
}

/**
 * Mengambil data kandidat paslon dari Spreadsheet/API dan merender kartu di Section 1
 * serta menyinkronkan video orasi YouTube di Bagian Orasi (Section 2) secara otomatis.
 */
async function loadHomeCandidates() {
  const container = document.getElementById('homeCandidatesGrid');
  if (!container) return;

  try {
    let paslonList = [];
    if (window.VotingAPI && typeof window.VotingAPI.fetchPaslonList === 'function') {
      paslonList = await window.VotingAPI.fetchPaslonList();
    }

    if (Array.isArray(paslonList) && paslonList.length > 0) {
      cachedPaslonList = paslonList;
      renderHomeCandidateCards(paslonList);
      syncOrasiYouTubeVideos(paslonList);
    } else {
      renderErrorCandidatesState(container, 'Data paslon belum tersedia di database.');
    }
  } catch (error) {
    console.error('[App] Gagal memuat data paslon beranda:', error);
    renderErrorCandidatesState(container, 'Gagal menyinkronkan data paslon. Periksa koneksi jaringan.');
  }
}

/**
 * Merender kartu paslon dinamis dengan transisi fade-in menggantikan skeleton
 * @param {Array} list - Daftar paslon dari database
 */
function renderHomeCandidateCards(list) {
  const container = document.getElementById('homeCandidatesGrid');
  if (!container) return;

  let html = '';

  list.forEach(function (paslon, idx) {
    const noUrut = (paslon.nomor_urut < 10 ? '0' : '') + paslon.nomor_urut;
    const label = paslon.label_paslon || ('PASLON ' + paslon.nomor_urut);
    const nama = paslon.nama_paslon || 'Calon Ketua & Wakil Ketua';
    const slogan = paslon.slogan || '';
    
    // Terapkan trik lh3.googleusercontent.com
    const foto = (window.VotingAPI && typeof window.VotingAPI.formatImageUrl === 'function')
      ? window.VotingAPI.formatImageUrl(paslon.foto_url)
      : paslon.foto_url;

    // Disematkan onclick ke selectHomeCandidate untuk inline sliding Visi Misi
    html += '<article class="candidate-card fade-in-card" onclick="window.App.selectHomeCandidate(' + idx + ')" title="Klik untuk melihat Visi & Misi ' + label + '">';
    html += '  <div class="photo-frame">';
    html += '    <span class="badge-no-urut">' + noUrut + '</span>';
    html += '    <img src="' + foto + '" alt="' + label + '" referrerpolicy="no-referrer" loading="lazy">';
    html += '  </div>';
    html += '  <div>';
    html += '    <h3 class="card-label">' + label + '</h3>';
    html += '    <p class="card-names">' + nama + '</p>';
    if (slogan) {
      html += '    <p class="card-slogan">"' + slogan + '"</p>';
    }
    html += '    <div class="card-btn-visi">';
    html += '      <span>&#10022; Visi &amp; Misi</span>';
    html += '    </div>';
    html += '  </div>';
    html += '</article>';
  });

  container.innerHTML = html;
}

/**
 * Menampilkan kartu error ramah jika sinkronisasi database gagal
 * @param {HTMLElement} container - Kontainer kandidat
 * @param {string} message - Pesan error
 */
function renderErrorCandidatesState(container, message) {
  let errorHtml = '';
  errorHtml += '<div style="grid-column: 1 / -1; background: rgba(255, 255, 255, 0.18); border: 1.5px solid rgba(255, 255, 255, 0.35); border-radius: 16px; padding: 24px; text-align: center; color: #ffffff;">';
  errorHtml += '  <p style="font-size: 0.95rem; font-weight: 600; margin-bottom: 12px;">' + message + '</p>';
  errorHtml += '  <button type="button" class="btn-primary" style="display: inline-block; width: auto; padding: 8px 22px; font-size: 0.85rem;" onclick="window.App.loadHomeCandidates()">Muat Ulang Data</button>';
  errorHtml += '</div>';
  container.innerHTML = errorHtml;
}

// Daftar ID Video YouTube Orasi Resmi Paslon 1, 2, dan 3
const ORASI_VIDEO_IDS = [
  'pD5AaON3dBE', // Paslon 1: https://youtu.be/pD5AaON3dBE
  'XLirKHUzDy8', // Paslon 2: https://youtu.be/XLirKHUzDy8
  'hb58ZUUI19o'  // Paslon 3: https://youtu.be/hb58ZUUI19o
];

/**
 * Menyinkronkan video orasi YouTube di Bagian Orasi berdasarkan daftar video resmi paslon
 * @param {Array} list - Daftar paslon dari database
 */
function syncOrasiYouTubeVideos(list) {
  list.forEach(function (paslon, idx) {
    const videoId = ORASI_VIDEO_IDS[idx] || paslon.youtube_video_id || 'pD5AaON3dBE';
    const iframeId = 'iframeOrasi' + (idx + 1);
    const labelId = 'labelOrasi' + (idx + 1);

    const elIframe = document.getElementById(iframeId);
    const elLabel = document.getElementById(labelId);

    if (elIframe) {
      elIframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      elIframe.src = 'https://www.youtube-nocookie.com/embed/' + videoId + '?enablejsapi=1&controls=1&rel=0';
      elIframe.title = 'Orasi ' + (paslon.label_paslon || ('PASLON ' + (idx + 1)));
    }

    if (elLabel && paslon.label_paslon) {
      elLabel.textContent = 'ORASI ' + paslon.label_paslon;
    }
  });
}

/**
 * Mengatur ulang pelindung sentuh (touch shield) di atas iframe TV agar layar TV dapat di-swipe kembali
 */
function resetOrasiTouchShields() {
  const shields = document.querySelectorAll('.tv-touch-shield');
  shields.forEach(function (shield) {
    shield.classList.remove('unlocked');
  });
}

/**
 * Menggeser slide Orasi Paslon ke samping secara halus (0 = Paslon 1, 1 = Paslon 2, 2 = Paslon 3)
 * @param {number} targetIndex - Indeks slide orasi (0, 1, atau 2)
 */
function slideOrasiTo(targetIndex) {
  const totalSlides = 3;
  const clampedIndex = ((targetIndex % totalSlides) + totalSlides) % totalSlides;

  if (clampedIndex !== currentActiveOrasiIndex) {
    stopAllYouTubeVideos();
  }

  resetOrasiTouchShields();
  currentActiveOrasiIndex = clampedIndex;

  const track = document.getElementById('orasiSliderTrack');
  if (track) {
    track.classList.remove('is-dragging');
    track.style.transform = 'translate3d(-' + (clampedIndex * 100) + '%, 0, 0)';
  }

  const slides = document.querySelectorAll('.orasi-slide');
  slides.forEach(function (slide, idx) {
    slide.style.transform = '';
    slide.style.opacity = '';
    if (idx === clampedIndex) {
      slide.classList.add('active-slide');
    } else {
      slide.classList.remove('active-slide');
    }
  });

  const tabPills = document.querySelectorAll('.orasi-tab-pill');
  tabPills.forEach(function (pill, idx) {
    if (idx === clampedIndex) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  const swipeDots = document.querySelectorAll('.orasi-swipe-dot');
  swipeDots.forEach(function (dot, idx) {
    if (idx === clampedIndex) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
}

/**
 * Geser ke Orasi Paslon sebelumnya (kiri)
 */
function prevOrasi() {
  slideOrasiTo(currentActiveOrasiIndex - 1);
}

/**
 * Geser ke Orasi Paslon berikutnya (kanan)
 */
function nextOrasi() {
  slideOrasiTo(currentActiveOrasiIndex + 1);
}

/**
 * Menuju section Bagian Orasi (Section 2) dan langsung menggeser ke paslon tertentu
 * @param {number} paslonIndex - Indeks paslon (0, 1, atau 2)
 */
function goToOrasi(paslonIndex) {
  slideOrasiTo(paslonIndex || 0);
  goToSection(2);
}

/**
 * Inisialisasi gestur geser samping interaktif (real-time touch-swipe drag, mouse drag, & trackpad scroll)
 * pada Bagian Orasi agar navigasi antar video kandidat intuitif dan ramah perangkat mobile.
 */
function initOrasiHorizontalGestures() {
  const orasiSection = document.getElementById('sec-2');
  const viewport = document.getElementById('orasiSliderViewport');
  const track = document.getElementById('orasiSliderTrack');
  if (!orasiSection || !viewport || !track) return;

  let startX = 0;
  let startY = 0;
  let currentDeltaX = 0;
  let startTime = 0;
  let isPointerDown = false;
  let isHorizontalSwipe = null; // null = belum ditentukan, true = horizontal, false = vertikal

  function getViewportWidth() {
    return viewport.offsetWidth || window.innerWidth || 360;
  }

  function applyLiveDragTransform(dx) {
    const width = getViewportWidth();
    // Beri sedikit resistensi karet (rubber-band) jika geseran sangat jauh
    const maxDrag = width * 0.85;
    const clampedDx = Math.max(-maxDrag, Math.min(maxDrag, dx));
    const offsetPercent = (clampedDx / width) * 100;
    const basePercent = -(currentActiveOrasiIndex * 100);

    track.classList.add('is-dragging');
    viewport.classList.add('is-dragging');
    track.style.transform = 'translate3d(' + (basePercent + offsetPercent).toFixed(2) + '%, 0, 0)';
  }

  function finishSwipeGesture(dx, durationMs, eventTarget) {
    track.classList.remove('is-dragging');
    viewport.classList.remove('is-dragging');

    const width = getViewportWidth();
    const absDx = Math.abs(dx);
    const velocity = durationMs > 0 ? (absDx / durationMs) : 0; // px per ms

    // Jika hanya ketukan singkat (tap) di atas layar TV, buka shield & putar video YouTube
    if (absDx < 10 && eventTarget && eventTarget.classList && eventTarget.classList.contains('tv-touch-shield')) {
      track.style.transform = 'translate3d(-' + (currentActiveOrasiIndex * 100) + '%, 0, 0)';
      eventTarget.classList.add('unlocked');
      const shieldIdx = parseInt(eventTarget.getAttribute('data-shield-index'), 10);
      const targetIframe = document.getElementById('iframeOrasi' + ((isNaN(shieldIdx) ? currentActiveOrasiIndex : shieldIdx) + 1));
      if (targetIframe && targetIframe.contentWindow) {
        try {
          targetIframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        } catch (err) {
          /* Safe ignore */
        }
      }
      return;
    }

    // Syarat pindah slide: jarak geser > 14% lebar layar (min 36px) ATAU flick cepat (velocity > 0.32 px/ms & jarak > 20px)
    const distanceThreshold = Math.max(36, width * 0.14);
    const isFlick = velocity > 0.32 && absDx > 20;

    if (absDx >= distanceThreshold || isFlick) {
      if (dx < 0) {
        nextOrasi();
      } else {
        prevOrasi();
      }
    } else {
      // Kembali mulus ke slide saat ini jika geseran belum cukup jauh
      slideOrasiTo(currentActiveOrasiIndex);
    }
  }

  // 1. Touch Events (Mobile & Tablet)
  orasiSection.addEventListener('touchstart', function (e) {
    if (!e.touches || e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentDeltaX = 0;
    startTime = Date.now();
    isPointerDown = true;
    isHorizontalSwipe = null;
  }, { passive: true });

  orasiSection.addEventListener('touchmove', function (e) {
    if (!isPointerDown || !e.touches || e.touches.length !== 1) return;

    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    if (isHorizontalSwipe === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        isHorizontalSwipe = Math.abs(dx) > Math.abs(dy);
      }
    }

    if (isHorizontalSwipe) {
      if (e.cancelable) {
        e.preventDefault();
      }
      currentDeltaX = dx;
      applyLiveDragTransform(dx);
    }
  }, { passive: false });

  function handleTouchEnd(e) {
    if (!isPointerDown) return;
    isPointerDown = false;

    const duration = Date.now() - startTime;
    const endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : (startX + currentDeltaX);
    const finalDx = isHorizontalSwipe ? (endX - startX) : 0;

    if (isHorizontalSwipe || Math.abs(endX - startX) < 10) {
      finishSwipeGesture(finalDx, duration, e.target);
    } else {
      slideOrasiTo(currentActiveOrasiIndex);
    }
    isHorizontalSwipe = null;
  }

  orasiSection.addEventListener('touchend', handleTouchEnd, { passive: true });
  orasiSection.addEventListener('touchcancel', handleTouchEnd, { passive: true });

  // 2. Mouse Drag Support (Desktop / Laptop / Touch-enabled Kiosk)
  viewport.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    if (e.target && e.target.closest && e.target.closest('.btn-orasi-capsule')) return;
    startX = e.clientX;
    startY = e.clientY;
    currentDeltaX = 0;
    startTime = Date.now();
    isPointerDown = true;
    isHorizontalSwipe = null;
  });

  window.addEventListener('mousemove', function (e) {
    if (!isPointerDown) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (isHorizontalSwipe === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      isHorizontalSwipe = Math.abs(dx) > Math.abs(dy);
    }

    if (isHorizontalSwipe) {
      currentDeltaX = dx;
      applyLiveDragTransform(dx);
    }
  });

  window.addEventListener('mouseup', function (e) {
    if (!isPointerDown) return;
    isPointerDown = false;
    const duration = Date.now() - startTime;
    const finalDx = e.clientX - startX;

    if (isHorizontalSwipe || Math.abs(finalDx) < 10) {
      finishSwipeGesture(isHorizontalSwipe ? finalDx : 0, duration, e.target);
    } else {
      slideOrasiTo(currentActiveOrasiIndex);
    }
    isHorizontalSwipe = null;
  });

  // 3. Dukungan geser 2 jari horizontal di touchpad laptop
  let lastWheelSlideTime = 0;
  orasiSection.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 22) {
      const now = Date.now();
      if (now - lastWheelSlideTime > 650) {
        lastWheelSlideTime = now;
        if (e.deltaX > 0) {
          nextOrasi();
        } else {
          prevOrasi();
        }
      }
    }
  }, { passive: true });
}

/**
 * Membuka Modal Visi & Misi Paslon
 * @param {number} paslonIndex - Indeks paslon (0, 1, atau 2)
 */
function openVisiMisiModal(paslonIndex) {
  stopAllYouTubeVideos();

  // Jika sedang di section beranda (Section 1), gunakan pengalaman inline sliding yang mulus
  if (currentActiveView === SPA_VIEWS.HOME && currentActiveSectionIndex === 1) {
    selectHomeCandidate(paslonIndex || 0);
    return;
  }

  // Jika dipanggil dari section orasi/footer, buka tampilan visi-misi paslon di Section 1
  selectHomeCandidate(paslonIndex || 0);
  goToSection(1);
}

/**
 * Beralih antar-tab Paslon 1, 2, atau 3 di dalam modal Visi & Misi
 * @param {number} paslonIndex - Indeks paslon yang ingin ditampilkan
 */
function switchVisiMisiTab(paslonIndex) {
  currentVisiModalIndex = paslonIndex;

  // Update status tombol tab aktif
  for (let i = 0; i < 3; i++) {
    const tabBtn = document.getElementById('tabBtn' + i);
    if (tabBtn) {
      if (i === paslonIndex) {
        tabBtn.classList.add('active');
      } else {
        tabBtn.classList.remove('active');
      }
    }
  }

  // Jika data paslon tersedia di cache
  if (cachedPaslonList && cachedPaslonList[paslonIndex]) {
    const paslon = cachedPaslonList[paslonIndex];

    const elFoto = document.getElementById('visiModalFoto');
    const elBadge = document.getElementById('visiModalBadge');
    const elLabel = document.getElementById('visiModalLabel');
    const elNames = document.getElementById('visiModalNames');
    const elSlogan = document.getElementById('visiModalSlogan');
    const elText = document.getElementById('visiModalText');

    const formattedFoto = (window.VotingAPI && typeof window.VotingAPI.formatImageUrl === 'function')
      ? window.VotingAPI.formatImageUrl(paslon.foto_url)
      : paslon.foto_url;

    if (elFoto) elFoto.src = formattedFoto;
    if (elBadge) elBadge.textContent = (paslon.nomor_urut < 10 ? '0' : '') + paslon.nomor_urut;
    if (elLabel) elLabel.textContent = paslon.label_paslon || ('PASLON ' + paslon.nomor_urut);
    if (elNames) elNames.textContent = paslon.nama_paslon || '';
    if (elSlogan) elSlogan.textContent = paslon.slogan ? ('"' + paslon.slogan + '"') : '';
    if (elText) elText.textContent = paslon.visi_misi || 'Visi dan misi belum tersedia.';
  }
}

/**
 * Menutup Modal Visi & Misi Paslon
 */
function closeVisiMisiModal() {
  const modal = document.getElementById('modalVisiMisi');
  if (modal) {
    modal.classList.remove('open');
  }
}

/**
 * Berpindah tampilan layar SPA tanpa reload (0 millisecond latency)
 * @param {string} viewId - ID view tujuan ('view-home', 'view-bilik', 'view-selesai')
 */
function switchView(viewId) {
  const allViews = document.querySelectorAll('.spa-view');
  if (!allViews || allViews.length === 0) return;

  // Hentikan seluruh pemutaran video YouTube saat keluar dari halaman utama
  if (viewId !== SPA_VIEWS.HOME) {
    stopAllYouTubeVideos();
  }

  allViews.forEach(function (viewElement) {
    if (viewElement.id === viewId) {
      viewElement.classList.add('active');
      viewElement.style.display = 'block';
    } else {
      viewElement.classList.remove('active');
      viewElement.style.display = 'none';
    }
  });

  currentActiveView = viewId;

  // Inisialisasi logika bilik suara jika berpindah ke view-bilik
  if (viewId === SPA_VIEWS.BILIK) {
    if (window.VoteController && typeof window.VoteController.initBooth === 'function') {
      window.VoteController.initBooth();
    }
  }

  // Gulir layar ke atas untuk memastikan sudut pandang steril
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/**
 * Menghentikan/pause seluruh iframe video YouTube yang sedang berjalan
 * Memenuhi spesifikasi: Setiap pindah section, video orasi otomatis berhenti
 */
function stopAllYouTubeVideos() {
  resetOrasiTouchShields();
  const iframes = document.querySelectorAll('.tv-screen iframe, .inline-orasi-video-frame iframe');
  iframes.forEach(function (iframe) {
    try {
      // 1. Kirim sinyal YouTube iframe API untuk pause video
      iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    } catch (err) {
      /* Safe ignore */
    }

    // 2. Fallback peredam audio instan: refresh attribute src iframe jika masih memutar audio
    try {
      const src = iframe.getAttribute('src');
      if (src && src.indexOf('enablejsapi=1') === -1) {
        // Sisipkan parameter JS API jika belum ada
        const separator = src.indexOf('?') === -1 ? '?' : '&';
        iframe.setAttribute('src', src + separator + 'enablejsapi=1');
      }
    } catch (e) {
      /* Safe ignore */
    }
  });
}

/**
 * Navigasi halus menuju section bernomor urut tertentu pada halaman beranda
 * @param {number} targetIndex - Indeks section (0 sampai 3)
 */
function goToSection(targetIndex) {
  const sections = document.querySelectorAll('.snap-section');

  if (sections && sections[targetIndex]) {
    // Hentikan video yang sedang berjalan sebelum berpindah section
    stopAllYouTubeVideos();
    sections[targetIndex].scrollIntoView({ behavior: 'smooth' });
    updatePaginationDots(targetIndex);
  }
}

/**
 * Memastikan logo brand tetap diam di posisinya (tanpa animasi saat scroll/pindah section)
 * Sesuai instruksi: Logo diam terus di posisi itu tanpa animasi
 */
function animateNavOnSectionChange() {
  // Diam tanpa animasi sesuai permintaan pengguna
}

/**
 * Memperbarui status aktif titik navigasi pagination di sebelah kanan layar
 * @param {number} activeIndex - Indeks section yang sedang tampak
 */
function updatePaginationDots(activeIndex) {
  const dotButtons = document.querySelectorAll('.dot-item');
  dotButtons.forEach(function (dot, idx) {
    if (idx === activeIndex) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });

  currentActiveSectionIndex = activeIndex;
}

/**
 * Inisialisasi IntersectionObserver untuk mendeteksi section yang tampak di layar
 */
function initSectionObserver() {
  const snapContainer = document.getElementById('snapContainer');
  const sections = document.querySelectorAll('.snap-section');

  if (!snapContainer || sections.length === 0) return;

  const observerOptions = {
    root: snapContainer,
    threshold: 0.55 // Aktif saat lebih dari 55% bidang section terlihat
  };

  if (sectionObserverInstance) {
    sectionObserverInstance.disconnect();
  }

  sectionObserverInstance = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        const sectionId = entry.target.id;
        const index = parseInt(sectionId.replace('sec-', ''), 10);

        if (!isNaN(index) && index !== currentActiveSectionIndex) {
          // Matikan video jika pemilih berpindah section via scroll/swipe
          stopAllYouTubeVideos();
          updatePaginationDots(index);
        }
      }
    });
  }, observerOptions);

  sections.forEach(function (sec) {
    sectionObserverInstance.observe(sec);
  });
}

/**
 * Membuka modal pop-up otentikasi login pemilih
 */
function openLoginModal() {
  // Pastikan video orasi berhenti saat modal dibuka
  stopAllYouTubeVideos();

  const modal = document.getElementById('modalLogin');
  if (modal) {
    modal.classList.add('open');
    const inputUsername = document.getElementById('inputUsername');
    if (inputUsername) {
      setTimeout(function () {
        inputUsername.focus();
      }, 150);
    }
  }
}

/**
 * Menutup modal pop-up otentikasi login
 */
function closeLoginModal() {
  const modal = document.getElementById('modalLogin');
  if (modal) {
    modal.classList.remove('open');
  }
  const form = document.getElementById('formLogin');
  if (form) {
    form.reset();
  }
}

/**
 * Menangani pengiriman form login pemilih
 * @param {Event} event - DOM Form Event
 */
async function handleLoginFormSubmit(event) {
  if (event) {
    event.preventDefault();
  }

  const inputUsername = document.getElementById('inputUsername');
  const inputPassword = document.getElementById('inputPassword');
  const btnSubmit = document.getElementById('btnLoginSubmit');

  const username = inputUsername ? inputUsername.value : '';
  const password = inputPassword ? inputPassword.value : '';

  if (!btnSubmit) return;

  // Optimistic UI state
  const originalBtnHtml = btnSubmit.innerHTML;
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<span>Memverifikasi...</span>';

  try {
    const authResult = await window.AuthManager.loginVoter(username, password);

    if (authResult && authResult.success) {
      closeLoginModal();
      // Transisi instan ke bilik suara steril
      switchView(SPA_VIEWS.BILIK);
    }
  } catch (error) {
    window.AuthManager.showToast('Gagal memproses otentikasi: ' + error.message, 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = originalBtnHtml;
  }
}

/**
 * Menghubungkan pintasan keyboard untuk navigasi cepat di laptop / tablet keyboard
 */
function initKeyboardNavigation() {
  window.addEventListener('keydown', function (e) {
    // Hanya tangani keyboard jika sedang berada di view-home dan modal login tertutup
    const modal = document.getElementById('modalLogin');
    const isModalOpen = modal && modal.classList.contains('open');

    if (currentActiveView !== SPA_VIEWS.HOME || isModalOpen) {
      return;
    }

    const sections = document.querySelectorAll('.snap-section');
    const totalSections = sections.length;

    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      if (currentActiveSectionIndex < totalSections - 1) {
        goToSection(currentActiveSectionIndex + 1);
      }
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      if (currentActiveSectionIndex > 0) {
        goToSection(currentActiveSectionIndex - 1);
      }
    } else if (e.key === 'ArrowRight' && currentActiveSectionIndex === 2) {
      e.preventDefault();
      nextOrasi();
    } else if (e.key === 'ArrowLeft' && currentActiveSectionIndex === 2) {
      e.preventDefault();
      prevOrasi();
    } else if (e.key === 'ArrowRight' && currentActiveSectionIndex === 4) {
      e.preventDefault();
      nextGaleriPage();
    } else if (e.key === 'ArrowLeft' && currentActiveSectionIndex === 4) {
      e.preventDefault();
      prevGaleriPage();
    }
  });
}

/**
 * Memuat dan menyinkronkan data Galeri dari Google Sheets (sheet "galeri" via code.gs)
 */
async function loadHomeGaleri() {
  const track = document.getElementById('galeriSliderTrack');
  if (!track) return;

  try {
    let galeriList = [];
    if (window.VotingAPI && typeof window.VotingAPI.fetchGaleriList === 'function') {
      galeriList = await window.VotingAPI.fetchGaleriList();
    }

    if (Array.isArray(galeriList) && galeriList.length > 0) {
      cachedGaleriList = galeriList;
      renderHomeGaleriBento(galeriList);
    }
  } catch (error) {
    console.warn('[App] Gagal memuat galeri, menampilkan kerangka galeri default:', error);
  }
}

/**
 * Merender tata letak 5-Slot Bento Grid Galeri sesuai referensi (mendukung multi-halaman jika > 5 foto di Spreadsheet)
 * @param {Array} list - Daftar item galeri dari database
 */
function renderHomeGaleriBento(list) {
  const track = document.getElementById('galeriSliderTrack');
  const prevBtn = document.getElementById('btnGaleriPrev');
  const nextBtn = document.getElementById('btnGaleriNext');
  const paginationBar = document.getElementById('galeriPaginationBar');

  if (!track) return;

  const itemsPerPage = 5;
  totalGaleriPages = Math.max(1, Math.ceil(list.length / itemsPerPage));
  currentActiveGaleriPage = 0;

  let trackHtml = '';

  for (let pageIdx = 0; pageIdx < totalGaleriPages; pageIdx++) {
    const startIdx = pageIdx * itemsPerPage;
    trackHtml += '<div class="galeri-page' + (pageIdx === 0 ? ' active-page' : '') + '" data-galeri-page="' + pageIdx + '">';
    trackHtml += '  <div class="galeri-bento-grid">';

    for (let slot = 1; slot <= 5; slot++) {
      const itemIdx = startIdx + (slot - 1);
      const item = list[itemIdx];
      const rawUrl = item && item.foto_url ? String(item.foto_url).trim() : '';

      if (item && rawUrl) {
        const formattedUrl = (window.VotingAPI && typeof window.VotingAPI.formatImageUrl === 'function')
          ? window.VotingAPI.formatImageUrl(rawUrl)
          : rawUrl;
        const judul = item.judul || ('Dokumentasi #' + (itemIdx + 1));
        const ket = item.keterangan || '';

        trackHtml += '<article class="galeri-card galeri-slot-' + slot + ' has-photo" data-slot="' + slot + '" onclick="window.App.openGaleriPreviewModal(' + itemIdx + ')" title="' + judul.replace(/"/g, '&quot;') + '">';
        trackHtml += '  <img class="galeri-card-img" src="' + formattedUrl + '" alt="' + judul.replace(/"/g, '&quot;') + '" referrerpolicy="no-referrer" loading="lazy">';
        if (item.judul || item.keterangan) {
          trackHtml += '  <div class="galeri-card-overlay">';
          if (item.judul) {
            trackHtml += '    <div class="galeri-card-title">' + judul + '</div>';
          }
          if (ket) {
            trackHtml += '    <div class="galeri-card-desc">' + ket + '</div>';
          }
          trackHtml += '  </div>';
        }
        trackHtml += '</article>';
      } else {
        trackHtml += '<article class="galeri-card galeri-slot-' + slot + '" data-slot="' + slot + '"></article>';
      }
    }

    trackHtml += '  </div>';
    trackHtml += '</div>';
  }

  track.innerHTML = trackHtml;
  track.style.transform = 'translate3d(0%, 0, 0)';

  if (totalGaleriPages > 1) {
    if (prevBtn) prevBtn.style.display = 'flex';
    if (nextBtn) nextBtn.style.display = 'flex';
    if (paginationBar) {
      paginationBar.style.display = 'flex';
      let dotsHtml = '';
      for (let p = 0; p < totalGaleriPages; p++) {
        dotsHtml += '<button type="button" class="galeri-page-dot' + (p === 0 ? ' active' : '') + '" onclick="window.App.slideGaleriToPage(' + p + ')" aria-label="Halaman Galeri ' + (p + 1) + '"></button>';
      }
      paginationBar.innerHTML = dotsHtml;
    }
  } else {
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    if (paginationBar) paginationBar.style.display = 'none';
  }
}

/**
 * Menggeser halaman Galeri jika terdapat lebih dari 5 foto di Spreadsheet
 * @param {number} targetPage - Indeks halaman galeri
 */
function slideGaleriToPage(targetPage) {
  if (totalGaleriPages <= 1) return;
  const clamped = ((targetPage % totalGaleriPages) + totalGaleriPages) % totalGaleriPages;
  currentActiveGaleriPage = clamped;

  const track = document.getElementById('galeriSliderTrack');
  if (track) {
    track.style.transform = 'translate3d(-' + (clamped * 100) + '%, 0, 0)';
  }

  const dots = document.querySelectorAll('.galeri-page-dot');
  dots.forEach(function (dot, idx) {
    if (idx === clamped) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
}

function prevGaleriPage() {
  slideGaleriToPage(currentActiveGaleriPage - 1);
}

function nextGaleriPage() {
  slideGaleriToPage(currentActiveGaleriPage + 1);
}

/**
 * Membuka modal Lightbox untuk melihat foto dokumentasi Galeri secara penuh
 * @param {number} itemIdx - Indeks item pada cachedGaleriList
 */
function openGaleriPreviewModal(itemIdx) {
  if (!cachedGaleriList || !cachedGaleriList[itemIdx]) return;
  const item = cachedGaleriList[itemIdx];
  if (!item.foto_url) return;

  const modal = document.getElementById('modalGaleriPreview');
  const elImg = document.getElementById('galeriPreviewImg');
  const elBadge = document.getElementById('galeriPreviewSlotBadge');
  const elTitle = document.getElementById('galeriPreviewTitle');
  const elDesc = document.getElementById('galeriPreviewDesc');

  const formattedUrl = (window.VotingAPI && typeof window.VotingAPI.formatImageUrl === 'function')
    ? window.VotingAPI.formatImageUrl(item.foto_url)
    : item.foto_url;

  if (elImg) elImg.src = formattedUrl;
  if (elBadge) elBadge.textContent = item.posisi_slot ? ('GALERI • ' + item.posisi_slot) : ('GALERI #' + (itemIdx + 1));
  if (elTitle) elTitle.textContent = item.judul || ('Dokumentasi Pemilihan #' + (itemIdx + 1));
  if (elDesc) elDesc.textContent = item.keterangan || '';

  if (modal) {
    modal.classList.add('open');
  }
}

/**
 * Menutup modal Lightbox Galeri
 */
function closeGaleriPreviewModal() {
  const modal = document.getElementById('modalGaleriPreview');
  if (modal) {
    modal.classList.remove('open');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  // 1. Inisialisasi observer section
  initSectionObserver();

  // 2. Pasang keyboard navigation & gestur geser samping orasi
  initKeyboardNavigation();
  initOrasiHorizontalGestures();

  // 3. Kunci browser history agar tombol Back tidak membatalkan alur bilik
  if (window.AuthManager && typeof window.AuthManager.lockBrowserHistory === 'function') {
    window.AuthManager.lockBrowserHistory();
  }

  // 4. Daftarkan auth listener: Jika sesi habis / logout, kembalikan ke view-home
  if (window.AuthManager && typeof window.AuthManager.onAuthStateChanged === 'function') {
    window.AuthManager.onAuthStateChanged(function (isLoggedIn) {
      if (!isLoggedIn && currentActiveView === SPA_VIEWS.BILIK) {
        switchView(SPA_VIEWS.HOME);
      }
    });
  }

  // 5. Muat data awal Quick Count saat halaman pertama kali siap
  if (window.QuickCountVisualizer && typeof window.QuickCountVisualizer.refreshData === 'function') {
    window.QuickCountVisualizer.refreshData();
  }

  // 6. Muat dan render data Paslon serta Galeri dari Spreadsheet ke Beranda secara dinamis
  loadHomeCandidates();
  loadHomeGaleri();
});

/**
 * Mengisi cepat username & password akun demo untuk kemudahan pengujian
 */
function fillDemoLogin(u, p) {
  const inputUsername = document.getElementById('inputUsername');
  const inputPassword = document.getElementById('inputPassword');
  if (inputUsername) inputUsername.value = u || 'keisha_101';
  if (inputPassword) inputPassword.value = p || 'xT8kL2';
}

// Ekspor modul controller ke window global
window.App = {
  VIEWS: SPA_VIEWS,
  switchView: switchView,
  goToSection: goToSection,
  slideOrasiTo: slideOrasiTo,
  prevOrasi: prevOrasi,
  nextOrasi: nextOrasi,
  goToOrasi: goToOrasi,
  openLoginModal: openLoginModal,
  closeLoginModal: closeLoginModal,
  handleLoginFormSubmit: handleLoginFormSubmit,
  fillDemoLogin: fillDemoLogin,
  stopAllYouTubeVideos: stopAllYouTubeVideos,
  openVisiMisiModal: openVisiMisiModal,
  closeVisiMisiModal: closeVisiMisiModal,
  switchVisiMisiTab: switchVisiMisiTab,
  loadHomeCandidates: loadHomeCandidates,
  loadHomeGaleri: loadHomeGaleri,
  slideGaleriToPage: slideGaleriToPage,
  prevGaleriPage: prevGaleriPage,
  nextGaleriPage: nextGaleriPage,
  openGaleriPreviewModal: openGaleriPreviewModal,
  closeGaleriPreviewModal: closeGaleriPreviewModal,
  selectHomeCandidate: selectHomeCandidate,
  showInlineOrasiVideo: showInlineOrasiVideo,
  showInlineVisiMisi: showInlineVisiMisi,
  closeHomeCandidateDetail: closeHomeCandidateDetail,
  animateNavOnSectionChange: animateNavOnSectionChange
};
