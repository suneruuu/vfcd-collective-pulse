const CREDITS = [
  ["Beep Touch.wav", "IndigoRay", "https://freesound.org/s/339133/", "CC0 1.0"],
  ["Isolated Cricket Loop.wav", "phylobates", "https://freesound.org/s/493801/", "CC BY 4.0"],
  ["Bird, Thrush Nightingale 01.wav", "LilMati", "https://freesound.org/s/365658/", "CC0 1.0"],
  [
    "The Magic of Our Everyday Interactions",
    "human gazpacho",
    "https://freemusicarchive.org/music/human-gazpacho/divine-silence/the-magic-of-our-everyday-interactions/",
    "CC BY-SA 4.0",
  ],
  [
    "Miền Quê_Gió Thổi Qua Cánh Đồng Lúa_Phú Yên 2026",
    "Vietnamsoundlibrary.com",
    "https://soundcloud.com/vietnamsoundlibrary/mien-que_gio-thoi-qua-canh-dong-lua_phu-yen-2026-7",
  ],
  [
    "Rừng_Mùa Hè-Buổi Sáng-Ve Kêu Sau Mưa_VQG Cát Tiên 2026",
    "Vietnamsoundlibrary.com",
    "https://soundcloud.com/vietnamsoundlibrary/rung_mua-he-buoi-sang-ve-keu-sau-mua_vqg-cat-tien-2026-18",
  ],
  [
    "Rừng_Mùa Hè-Buổi Trưa-Gió Nhẹ-Côn Trùng Kêu-Tiếng Người Vọng Từ Xa_VQG Cát Tiên 2026",
    "Vietnamsoundlibrary.com",
    "https://soundcloud.com/vietnamsoundlibrary/rung_mua-he-buoi-trua-gio-nhe-con-trung-keu-tieng-nguoi-vong-tu-xa_vqg-cat-tien-2026-19",
  ],
];

export function InstallationCredits() {
  return (
    <footer id="installation-credits" aria-label="Audio credits">
      {CREDITS.map(([title, creator, source, license], index) => (
        <span key={source}>
          {index > 0 && <strong aria-hidden="true"> | </strong>}
          {title} by <em>{creator}</em> | {source}
          {license && ` | ${license}`}
        </span>
      ))}
    </footer>
  );
}
