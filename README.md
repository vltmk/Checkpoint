# Vault // Nodra Freelance & Gaming Ledger
# CHECKPOINT // دفتر کل و مدیریت کارهای فریلنسری و بوستینگ گیمینگ

A monochromatic, high-density Shadcn mini-app ledger crafted for **freelancers, gaming boosters, raid runners, addon creators, and digital devs**.
<div align="center">

![UI - Monochromatic Shadcn](https://img.shields.io/badge/UI-Monochromatic%20Shadcn-black?style=flat-square)
![Animation - Motion](https://img.shields.io/badge/Animation-Motion%20%28React%29-10b981?style=flat-square)
![Framework - Vite React](https://img.shields.io/badge/Stack-Vite%20%2B%20React-3b82f6?style=flat-square)
![Currencies](https://img.shields.io/badge/Currencies-USD%20%7C%20TOMAN%20%7C%20GOLD-fafafa?style=flat-square)
**نرم‌افزار مدیریت کارهای فریلنسری، ثبت بوست‌ها و ریدهای گیمینگ (ویژه بوسترهای ایرانی و World of Warcraft)**

![Checkpoint UI](https://img.shields.io/badge/Platform-Windows%20Desktop%20%7C%20Web-black?style=for-the-badge)
![Offline First](https://img.shields.io/badge/Storage-100%25%20Offline%20%26%20Local-10b981?style=for-the-badge)
![Currencies](https://img.shields.io/badge/Currencies-%D8%AA%D9%88%D9%85%D8%A7%D9%86%20%7C%20WoW%20Gold-f59e0b?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

</div>

---

## What's New in Vault 3.0
## 🎯 چک‌پوینت (CHECKPOINT) چیست؟

- 📱 **Tablet-Width Desktop Shell & Mobile Bottom Dock**: Centered `max-w-5xl` tablet shell with a sleek left sidebar navigation on desktop and a floating mobile navigation dock.
- 🪙 **Mathematical Bi-Directional Currency Engine**: Full bi-directional conversion between **USD ($)**, **IRANIAN TOMAN (تومان)**, and **GOLD (🪙)** with configurable live rates.
- 🔄 **Dedicated Gold Exchange View**: Live 2-way Gold to Fiat calculator, realm token presets, and portfolio gold valuation.
- 📋 **Direct `Ctrl+V` Screenshot Paste**: Instant clipboard screenshot pasting (`Win+Shift+S`) into the work modal.
- 🧾 **Proof-of-Work Receipts & Discord MD**: Printable work receipt slips and 1-click Discord Markdown copy for instant client sharing.
- 📊 **Monochromatic Analytics & Overview**: High-contrast, clean Chart.js velocity and game share donut visualizations shown by default.
- 💾 **Zero Quota Limit Storage**: Built on **IndexedDB** (`src/lib/db.js`) with full JSON backup/restore and CSV export.
**چک‌پوینت** یک نرم‌افزار سبک، سریع و کاملاً آفلاین است که مخصوص **گیمرهای بوستر، رانرهای رید و دانجن، سازندگان ادان و ویراورا، و فریلنسرهای دیجیتال ایرانی** طراحی شده است.

اگر در بازی‌هایی مثل **World of Warcraft (Retail & Classic)** یا پلتفرم‌هایی مثل **G2G، FunPay، Eldorado، دیسکورد یا ریدهای گیلدی (GDKP)** فعالیت می‌کنید، چک‌پوینت به شما کمک می‌کند تمام درآمدها، طلب‌ها، سهم هم‌تیمی‌ها و اسکرین‌شات‌های مدرک کارتان را به منظم‌ترین شکل ممکن ثبت و مدیریت کنید.

---

## Keyboard Shortcuts
## ✨ قابلیت‌های اصلی چک‌پوینت

| Shortcut | Action |
### ۱. 🔒 کاملاً آفلاین و امن (۱۰۰٪ Local & Private)
- تمامی اطلاعات، مبالغ، یادداشت‌ها و اسکرین‌شات‌های شما **فقط روی کامپیوتر خودتان** ذخیره می‌شوند.
- هیچ نیازی به اتصال اینترنت وجود ندارد و هیچ داده‌ای به هیچ سرور یا شخص ثالثی ارسال نمی‌شود.
- سرعت فوق‌العاده بالا به لطف استفاده از موتور پایگاه‌داده محلی (**SQLite** در نسخه دسکتاپ و **IndexedDB** در مرورگر).

---

### ۲. 🪙 تبدیل هوشمند و دوطرفه گلد (Gold) و تومان (TOMAN)
- **پشتیبانی اختصاصی از اقتصاد World of Warcraft**:
  - نرخ گلد در نسخه Retail (به ازای هر ۱۰۰۰ گلد).
  - نرخ گلد در نسخه Classic (به صورت تک گلد).
- امکان تغییر نرخ پیش‌فرض لحظه‌ای با یک کلیک.
- محاسبه آنی و خودکار درآمد کل، مبالغ تسویه‌شده (**Paid**) و مبالغ در انتظار پرداخت یا در حال انجام (**Pending / Working**).

---

### ۳. 📋 چسباندن فوری اسکرین‌شات مدرک با `Ctrl+V` (Proof of Work)
- نیازی به ذخیره کردن فایل اسکرین‌شات روی دسکتاپ نیست!
- کافیست با ابزار عکس‌برداری ویندوز (`Win + Shift + S`) از پایان دانجن، ترید گلد یا تاییدیه مشتری عکس بگیرید و مستقیماً داخل پنجره ثبت کار `Ctrl + V` بزنید تا عکس ضمیمه شود.
- امکان مشاهده تصاویر در اندازه کامل (Lightbox) و دانلود آن‌ها.

---

### ۴. 🧾 صدور رسید کار و خروجی دیسکورد (Receipt & Discord Export)
- ایجاد فاکتور و رسید مرتب شامل عنوان کار، کارفرما/پلتفرم، زمان، دستمزد و اسکرین‌شات‌ها.
- **کپی با یک کلیک برای دیسکورد (Discord Markdown)**: متن گزارش را به صورت آماده در دیسکورد برای کارفرما، لیدر یا مشتری بفرستید.
- امکان ذخیره تصویر رسید برای ارسال در تلگرام یا دیسکورد.

---

### ۵. 👥 مدیریت کارهای تیمی و تقسیم سهم (Team Runs & Split Payouts)
- برای ریدهای دونفره یا چندنفره (Duo / Team / GDKP)، نام هم‌تیمی‌ها را مشخص کنید.
- امکان فیلتر کردن فوری کارها بر اساس نام هر هم‌تیمی برای محاسبه بدهی‌ها یا سهم نهایی.

---

### ۶. 📊 نمودارها و آمار مالی دقیق (Analytics)
- نمایش روند درآمد ماهانه به تومان یا گلد.
- تفکیک سهم درآمدی بازی‌ها و پلتفرم‌ها (Retail vs Classic vs Addons).

---

## 💾 راهنمای پشتیبان‌گیری (Backup) و بازیابی (Restore)

چون چک‌پوینت کاملاً آفلاین است، کنترل کامل فایل‌های داده در دست شماست. همیشه می‌توانید از کارهایتان بکاپ بگیرید یا آنها را به کامپیوتر دیگری منتقل کنید.

### 📥 نحوه گرفتن نسخه پشتیبان (Backup)
1. کلید میانبر `Ctrl + ,` را بزنید یا روی آیکون **Settings (چرخ‌دنده)** در بالای صفحه کلیک کنید.
2. در بخش **Data Backup & Portability**:
   - **Full JSON Backup**: یک فایل پشتیبان کامل شامل تمام کارهای ثبت‌شده به همراه اسکرین‌شات‌ها دانلود می‌شود. این فایل را در جای امن (مانند گوگل درایو یا فلش) نگه دارید.
   - **Export CSV Spreadsheet**: فایل اکسل از لیست کارها برای حساب‌کتاب شخصی یا گزارش‌گیری.

### 📤 نحوه بازگردانی اطلاعات (Restore)
1. پنجره **Settings** را باز کنید.
2. روی دکمه **Restore JSON** کلیک کنید و فایل بکاپ `.json` قبلی خود را انتخاب کنید.
3. در چند ثانیه تمام اطلاعات و تصاویر بدون هیچ نقصی جایگذاری و بازگردانی می‌شوند.

### 🛡️ اسنپ‌شات‌های خودکار روزانه (Automatic Snapshots)
- نسخه دسکتاپ ویندوز به صورت خودکار روزانه یک نسخه پشتیبان داخلی ذخیره می‌کند تا حتی اگر اشتباهاً رکوردی را پاک کردید، بتوانید با یک کلیک از لیست اسنپ‌شات‌ها به روزهای قبل برگردید.

---

## ⌨️ کلیدهای میانبر پرکاربرد (Shortcuts)

برای اینکه سریع‌تر و بدون نیاز به موس با برنامه کار کنید، کلیدهای زیر در دسترس هستند:

| کلید میانبر | عملکرد |
| :--- | :--- |
| <kbd>?</kbd> | Open Keyboard Shortcuts Guide |
| <kbd>N</kbd> | Log New Work Entry |
| <kbd>1</kbd> | Overview View |
| <kbd>2</kbd> | Ledger View |
| <kbd>3</kbd> | Analytics View |
| <kbd>4</kbd> | Exchange View |
| <kbd>/</kbd> | Focus Search Bar |
| <kbd>Alt</kbd>+<kbd>E</kbd> | Export Ledger to CSV |
| <kbd>Alt</kbd>+<kbd>B</kbd> | Full JSON Backup with Screenshots |
| <kbd>Ctrl</kbd>+<kbd>V</kbd> | Paste Screenshot Proof (in modal) |
| <kbd>Esc</kbd> | Close any open modal or clear search |
| <kbd>N</kbd> | باز کردن پنجره ثبت کار جدید (**Add Work**) |
| <kbd>Q</kbd> | باز کردن پنجره ثبت سریع کار (**Quick Add**) |
| <kbd>/</kbd> | فوکوس فوری روی کادر جستجو و فیلترها |
| <kbd>?</kbd> | نمایش لیست راهنمای کلیدهای میانبر |
| <kbd>Ctrl</kbd> + <kbd>,</kbd> | باز کردن تنظیمات و بخش پشتیبان‌گیری |
| <kbd>Ctrl</kbd> + <kbd>V</kbd> | چسباندن اسکرین‌شات کپی‌شده از کلیپ‌بورد در فرم کار |
| <kbd>Esc</kbd> | بستن پنجره‌ها یا خروج از حالت جستجو |

---

## Getting Started
## 🚀 نصب و راه‌اندازی برای برنامه‌نویسان (Development)

اگر می‌خواهید روی پروژه توسعه دهید یا تغییرات اختصاصی اعمال کنید:

```bash
# 1. Install dependencies
# ۱. کلون کردن ریپازیتوری
git clone https://github.com/your-username/checkpoint.git
cd checkpoint

# ۲. نصب پکیج‌ها
npm install

# 2. Run local development server
# ۳. اجرای سرور توسعه (Vite Web)
npm run dev

# 3. Build for production
npm run build
# ۴. اجرای نسخه دسکتاپ (Tauri Desktop Dev)
npm run desktop:dev

# ۵. ساخت فایل نصبی ویندوز (Build NSIS & MSI Installer)
npm run desktop:build
```

---

## Developer Guide
## 🛠️ تکنولوژی‌های استفاده شده

For code conventions, component hierarchy, and git manual workflow, see [`AGENTS.md`](./AGENTS.md).
- **هسته دسکتاپ**: [Tauri 2](https://tauri.app/) + Rust
- **فرانت‌اند**: React 18 + Vite
- **استایل و دیزاین**: Tailwind CSS + Shadcn Dark Zinc Design System
- **انیمیشن‌ها**: Motion (`motion/react`)
- **پایگاه داده**: SQLite محلی (Tauri Plugin SQL) / IndexedDB
- **فونت‌ها**: IRANYekanRd (فارسی) + Ioskeley Mono (اعداد و مقادیر) + Inter

---

## 📄 لایسنس (License)

این پروژه تحت لایسنس **MIT** منتشر شده است. استفاده، شخصی‌سازی و توسعه آن برای تمامی کاربران و گیمرها آزاد است.
