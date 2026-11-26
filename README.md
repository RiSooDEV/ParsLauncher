<div align="center">

# Pars Launcher | پارس لانچر
**لانچر مدرن، سریع و آفلاین‌محور ماینکرفت**

[![Tauri](https://img.shields.io/badge/Tauri-v2-24c8db?style=flat-square&logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-Stable-dea584?style=flat-square&logo=rust)](https://rust-lang.org)
[![Modrinth](https://img.shields.io/badge/Modrinth-Integrated-00af5c?style=flat-square&logo=modrinth)](https://modrinth.com)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=flat-square)](LICENSE)

</div>

---

## پایه و اساس پروژه (Attribution)

این پروژه بر پایه [GlitchyLauncher](https://github.com/Deavaar/GlitchyLauncher) (نسخه 1.3.1) ساخته شده که خود آن پروژه تحت مجوز Apache-2.0 منتشر شده بود. این نسخه (فورک) نیز تحت همان مجوز Apache-2.0 منتشر می‌شود و تمام تغییرات اعمال‌شده نسبت به نسخه پایه در تاریخچه Git این ریپازیتوری قابل مشاهده است.

با تشکر از زحمات توسعه‌دهندگان پروژه پایه:
**`Mmd4J`** • **`MrRsd01`** • **`Maploop`** • **`Gnkalk`**

---

## ویژگی‌ها (Features)

* ورود آفلاین کامل — ساخت پروفایل آفلاین و اجرای بازی بدون نیاز به هیچ حساب ابری
* حساب ابری اختیاری (ParsAccount) برای همگام‌سازی پوست و آمار، بر بستر Cloudflare Workers و D1
* دستیار هوش مصنوعی برای عیب‌یابی لاگ‌ها و کرش‌ریپورت‌های بازی
* یکپارچگی مستقیم با مخزن رسمی Modrinth برای جستجو و نصب مادها، مادپک‌ها، شیدرها و ریسورس‌پک‌ها
* سیستم کوله‌پشتی (Backpack) برای مدیریت تفکیک‌شده محتوای هر اینستنس
* مدیریت پیشرفته اینستنس‌ها با ایزوله‌سازی کامل پوشه‌ها، سیوها و فایل‌های بازی و امکان انتخاب نام دلخواه برای هر اینستنس
* موتور دانلود موازی و پرسرعت همراه با بررسی خودکار چک‌سام و سلامت فایل‌ها
* پشتیبانی از میرورهای پرسرعت (Official Mojang، BMCLAPI، MCBBS) و 9Craft برای کاربران ایران
* سیستم بررسی نسخه و به‌روزرسانی خودکار با حالت بی‌صدا در نبود اینترنت
* ثبت آمار زمان بازی، رکوردهای روزانه، سیستم اچیومنت و بج‌ها
* رابط کاربری مدرن با پشتیبانی کامل از فارسی (فونت وزیرمتن، RTL) و انگلیسی
* استودیو پوست سه‌بعدی با پیش‌نمایش زنده و شنل‌های اختصاصی

---

## معماری فنی (Tech Stack)

| بخش | فناوری‌های اصلی |
| :--- | :--- |
| هسته لانچر (Backend) | Rust، Tauri v2، Tokio، Reqwest، Serde |
| رابط کاربری (Frontend) | React 19، TypeScript، Vite، Tailwind CSS، Base UI |
| سرویس ابری (اختیاری) | Cloudflare Workers، Cloudflare D1، Web Crypto |
| منابع داده | Modrinth API، Mojang Piston API، GitHub REST API |

---

## راهنمای بیلد و راه‌اندازی (Build & Development)

### پیش‌نیازها

* [Node.js](https://nodejs.org) نسخه 20 یا بالاتر
* [pnpm](https://pnpm.io) نسخه 9 یا بالاتر
* [Rust & Cargo](https://rustup.rs) آخرین نسخه پایدار

### اجرای نسخه توسعه

```bash
git clone <repository-url>
cd ParsLauncher

pnpm install

pnpm tauri dev
```

### کامپایل نسخه نهایی (Production Build)

```bash
# بیلد کامل (فرانت‌اند + Rust + نصاب NSIS)
pnpm tauri build

# یا بیلد دستی مرحله به مرحله
pnpm build
cargo build --release --manifest-path src-tauri/Cargo.toml
```

خروجی ویندوز در مسیر `src-tauri/target/release/Pars Launcher.exe` و نصاب NSIS در `src-tauri/target/release/bundle/nsis/` ساخته می‌شود.

---

## لایسنس (License)

این پروژه تحت مجوز [Apache License 2.0](LICENSE) منتشر می‌شود. جزئیات attribution پروژه پایه در بخش «پایه و اساس پروژه» همین سند آمده است.
