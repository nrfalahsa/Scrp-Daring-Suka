const { chromium } = require('playwright');
const fs = require('fs');

const STORAGE = 'storageState.json';
const DASHBOARD = 'https://daring.uin-suka.ac.id/dashboard';

function parseTanggal(str) {
  if (!str) return null;
  const m = str.match(/(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [_, d, mo, y, h, mi, s] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+07:00`);
}

(async () => {
  if (!fs.existsSync(STORAGE)) {
    console.log('❌ Jalankan save_session.js dulu untuk login.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STORAGE });
  const page = await context.newPage();

  await page.goto(DASHBOARD, { waitUntil: 'networkidle' });
  if (page.url().includes('/login')) {
    console.log('⚠️ Session kadaluarsa, login ulang dengan save_session.js');
    process.exit(1);
  }

  // 🔍 Ambil semua blok .post_content
  const data = await page.$$eval('div.post_content', divs =>
    divs.map(div => {
      const clean = t => (t ? t.replace(/Drop\s+files\s+here\s+to\s+upload/gi, '').trim() : '-');

      // Ambil header terdekat di atasnya
      let jenisKelas = '-', tipePertemuan = '-', pertemuanKe = '-', program = '-', matkul = '-', dosen = '-';
      let prev = div.previousElementSibling;

      // cari elemen h3 dan small di atas div.post_content
      while (prev && (!prev.querySelector('h3') || !prev.querySelector('small'))) {
        prev = prev.previousElementSibling;
      }

      if (prev) {
        const h3 = prev.querySelector('h3')?.innerText || '';
        const small = prev.querySelector('small')?.innerText || '';

        // Parsing dari <h3>
        const h3Match = h3.match(/^(.*?)\s*(?:Ke-?(\d+))?\s*$/i);
        if (h3Match) {
          const mainText = h3Match[1] || '';
          const span = prev.querySelector('h3 span')?.innerText || '';
          jenisKelas = clean(mainText.split(/\s+/)[0] || '-');
          tipePertemuan = clean(span || '-');
          pertemuanKe = clean(h3Match[2] || '-');
        }

        // Parsing dari <small>
        const parts = small.split('|').map(s => s.trim());
        program = parts[0] || '-';
        matkul = parts[1] || '-';
        dosen = parts[2] || '-';
      }

      // 🔹 Ambil konten utama di post_content
      const html = div.innerHTML;
      const indikator = clean((html.match(/Indikator Kemampuan\s*:<\/b><br>\s*<p>([\s\S]*?)<\/p>/i) || [])[1]
        ?.replace(/<br\s*\/?>/gi, '\n'));
      const materi = clean((html.match(/Materi Perkuliahan\s*:<\/b><br>\s*<p>([\s\S]*?)<\/p>/i) || [])[1]);
      const bentuk = clean((html.match(/Bentuk Pembelajaran\s*:<\/b><br>\s*<p>([\s\S]*?)<\/p>/i) || [])[1]);
      const deskripsi = clean((html.match(/<\/div><br>([\s\S]*?)<br><br><input/i) || [])[1]
        ?.replace(/<[^>]+>/g, ''));
      const fileMatch = (html.match(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/i) || []);
      const fileLink = fileMatch[1] || null;
      const fileName = fileMatch[2] || null;
      const waktuMulai = (html.match(/Waktu Mulai<\/td><td>:\s*([\d\-: ]+WIB)/i) || [])[1];
      const waktuSelesai = (html.match(/Waktu Selesai<\/td><td>:\s*([\d\-: ]+WIB)/i) || [])[1];
      const presensi = clean((html.match(/Presensi Perkuliahan\s*:<\/b><br>([\s\S]*?)<\/div>/i) || [])[1]
        ?.replace(/<[^>]+>/g, ''));

      return {
        jenisKelas,
        tipePertemuan,
        pertemuanKe,
        program,
        matkul,
        dosen,
        indikator,
        materi,
        bentuk,
        deskripsi,
        fileName,
        fileLink,
        waktuMulai,
        waktuSelesai,
        presensi
      };
    })
  );

  const now = new Date();
  const selesai = data.filter(p => {
    const end = parseTanggal(p.waktuSelesai);
    return end && end < now;
  });

  if (selesai.length === 0) {
    console.log('📭 Belum ada kegiatan yang selesai (atau format belum cocok).');
  } else {
    console.log(`🟢 Ditemukan ${selesai.length} kegiatan yang sudah selesai:\n`);
    for (const p of selesai) {
      console.log(`📚 ${p.jenisKelas} ${p.tipePertemuan} Ke-${p.pertemuanKe}`);
      console.log(`🏫 ${p.program} | ${p.matkul}`);
      console.log(`👩‍🏫 Dosen: ${p.dosen}`);
      console.log(`🎯 Indikator Kemampuan: ${p.indikator || '-'}`);
      console.log(`📘 Materi: ${p.materi || '-'}`);
      console.log(`🏫 Bentuk Pembelajaran: ${p.bentuk || '-'}`);
      console.log(`🗒️ Deskripsi: ${p.deskripsi || '-'}`);
      if (p.fileName) console.log(`📎 File: ${p.fileName} (${p.fileLink})`);
      console.log(`🕐 Waktu: ${p.waktuMulai || '-'} s.d. ${p.waktuSelesai || '-'}`);
      console.log(`✅ Presensi: ${p.presensi || '-'}`);
      console.log('----------------------------------------------------\n');
    }
  }

  await browser.close();
})();
