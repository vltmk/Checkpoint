/**
 * Compare two semver strings (e.g. "2.1.4" vs "2.1.5", ignores leading 'v').
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, and 0 if equal.
 */
export function compareSemver(v1, v2) {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  const clean1 = String(v1).replace(/^v/i, '').trim();
  const clean2 = String(v2).replace(/^v/i, '').trim();

  const p1 = clean1.split('.').map((x) => parseInt(x, 10) || 0);
  const p2 = clean2.split('.').map((x) => parseInt(x, 10) || 0);

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Bundled changelog registry keyed by semantic version.
 */
export const RELEASE_NOTES_REGISTRY = {
  '4.3.0': {
    date: '2026-10-15',
    title: {
      en: "What's New in Checkpoint v4.3.0",
      fa: 'تغییرات و امکانات نسخه ۴.۳.۰',
    },
    summary: {
      en: 'UI & UX improvements and upgrade',
      fa: 'ارتقا و بهبودهای رابط کاربری و تجربه کاربری (UI & UX)',
    },
    items: {
      en: [
        {
          tag: 'improved',
          text: 'UI & UX improvements and upgrade',
        },
      ],
      fa: [
        {
          tag: 'improved',
          text: 'ارتقا و بهبودهای رابط کاربری و تجربه کاربری (UI & UX)',
        },
      ],
    },
  },
  '4.2.0': {
    date: '2026-09-24',
    title: {
      en: "What's New in Checkpoint v4.2.0",
      fa: 'امکانات و تغییرات نسخه ۴.۲.۰',
    },
    summary: {
      en: 'Gold Ratio onboarding tour, Windows Smart App Control updater fallback, full EUR currency flow, and desktop ergonomics.',
      fa: 'راهنمای تعاملی نرخ روزانه گلد، راهکار امنیتی به‌روزرسانی برای Windows SAC، پشتیبانی کامل از ارز یورو (EUR) و ارتقای نوار ابزار.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: 'Interactive Gold Exchange Ratio onboarding tour for new users and after major app updates with dual-theme popover and persistence.',
        },
        {
          tag: 'new',
          text: 'Windows Smart App Control (SAC) & Security block safeguard in updater with dedicated error guidance and 1-click standalone installer download.',
        },
        {
          tag: 'new',
          text: 'Full EUR currency preservation across SQLite database and NumberStepperInput with decimal cents support and profile-scoped persistence.',
        },
        {
          tag: 'improved',
          text: 'Split primary action button on topbar for advertisers with immediate 1-click access to the Order Calculator.',
        },
        {
          tag: 'improved',
          text: 'Native desktop webview window icon initialization on application launch.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'راهنمای تعاملی و برجسته‌سازی نرخ روزانه تبدیل گلد برای کاربران تازه و پس از به‌روزرسانی با هماهنگی کامل تم روشن و تاریک.',
        },
        {
          tag: 'new',
          text: 'سازگاری با سیستم امنیتی Smart App Control ویندوز در به‌روزرسانی خودکار به همراه دکمه دانلود مستقیم فایل نصبی مستقل (.exe).',
        },
        {
          tag: 'new',
          text: 'پشتیبانی کامل و پایدار از ارز یورو (EUR) در دیتابیس SQLite با قابلیت اعشار و ذخیره آخرین ارز انتخابی هر پروفایل.',
        },
        {
          tag: 'improved',
          text: 'دکمه دوگانه در نوار ابزار پروفایل ادورتایزر برای دسترسی فوق سریع به ماشین‌حساب سفارشات.',
        },
        {
          tag: 'improved',
          text: 'تنظیم خودکار آیکون برنامه برای پنجره اصلی دسکتاپ هنگام باز شدن.',
        },
      ],
    },
  },
  '4.1.0': {
    date: '2026-09-24',
    title: {
      en: "What's New in Checkpoint v4.1.0",
      fa: 'امکانات و تغییرات نسخه ۴.۱.۰',
    },
    summary: {
      en: 'Order Calculator popover, deletion undo safety net, smart price sanitizer, date range filters, and workflow QoL enhancements.',
      fa: 'ماشین‌حساب سفارشات، قابلیت بازگردانی (Undo) حذف کارها، پاک‌سازی هوشمند ورودی‌های قیمت، فیلتر بازه زمانی و بهینه‌سازی‌های عملکردی.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: 'Integrated Order Calculator popover with platform fee presets (G2G, FunPay, PlayerAuctions, etc.), advertiser margins, booster cuts, and reverse quoting.',
        },
        {
          tag: 'new',
          text: 'Deletion Undo safety net toast allowing instant recovery of accidentally deleted entries.',
        },
        {
          tag: 'new',
          text: 'Smart price input sanitizer supporting Persian/Arabic digits, dot/comma thousand separators, and k/m multiplier suffixes.',
        },
        {
          tag: 'new',
          text: 'Date range preset filtering in Ledger (Today, Yesterday, This Week, This Month, etc.) and batch Discord receipt export.',
        },
        {
          tag: 'improved',
          text: 'Quick Add level-up bracket support for level 90 cap in World of Warcraft.',
        },
        {
          tag: 'improved',
          text: 'Refined brand iconography and desktop application icon assets across all platforms.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'ماشین‌حساب هوشمند ثبت سفارش با کارمزد پلتفرم‌ها (G2G و غیره)، درصد ادورتایزر و بوستر و محاسبه معکوس قیمت.',
        },
        {
          tag: 'new',
          text: 'پیام بازگردانی (Undo) هنگام حذف رکوردها جهت جلوگیری از خطای ناخواسته.',
        },
        {
          tag: 'new',
          text: 'پاک‌سازی و تشخیص هوشمند ورودی‌های قیمت شامل اعداد فارسی، جداکننده‌ها و ضرایب k و m.',
        },
        {
          tag: 'new',
          text: 'فیلتر بازه زمانی پیشرفته در دفتر کل و خروجی دسته‌ای دیسکورد.',
        },
        {
          tag: 'improved',
          text: 'پشتیبانی از لول ۹۰ در براکت‌های لول‌آپ World of Warcraft.',
        },
        {
          tag: 'improved',
          text: 'به‌روزرسانی آیکون‌های برنامه و نشان‌های بصری در تمامی پلتفرم‌ها.',
        },
      ],
    },
  },
  '4.0.1': {
    date: '2026-09-13',
    title: {
      en: "What's New in Checkpoint v4.0.1",
      fa: 'تغییرات نسخه ۴.۰.۱',
    },
    summary: {
      en: 'Quick patch fixing onboarding role selection dialog dismissal on first launch.',
      fa: 'پچ سریع برای رفع مشکل بسته نشدن دیالوگ خوش‌آمدگویی انتخاب نقش هنگام شروع کار.',
    },
    items: {
      en: [
        {
          tag: 'fix',
          text: 'Fixed Welcome role onboarding dialog (Booster vs Advertiser) not dismissing immediately upon clicking Get Started.',
        },
      ],
      fa: [
        {
          tag: 'fix',
          text: 'رفع مشکل بسته نشدن فوری پنجره انتخاب نقش اولیه (بوستر / ادورتایزر) پس از فشردن دکمه شروع کار.',
        },
      ],
    },
  },
  '4.0.0': {
    date: '2026-09-13',
    title: {
      en: "What's New in Checkpoint v4.0.0",
      fa: 'امکانات و تغییرات نسخه ۴.۰.۰',
    },
    summary: {
      en: 'Major upgrade introducing Advertiser and Booster profiles, expense tracking, redesigned Quick Add, UI/UX polish, and battery/power optimizations for laptops.',
      fa: 'ارتقای بزرگ با افزودن پروفایل‌های Advertiser و Booster، محاسبه هزینه‌ها در کنار ران‌ها، بازطراحی ثبت سریع و بهینه‌سازی مصرف باتری.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: 'Added Advertiser and Booster dedicated profiles with isolated databases and role-tailored workflows.',
        },
        {
          tag: 'new',
          text: 'Expense tracking alongside runs with automated net profit calculations.',
        },
        {
          tag: 'improved',
          text: 'Redesigned Quick Add dialog for streamlined and lightning-fast logging.',
        },
        {
          tag: 'improved',
          text: 'Comprehensive UI/UX enhancements, increased responsiveness, and reduced resource footprint.',
        },
        {
          tag: 'improved',
          text: 'Hardware and power optimizations specifically tailored for laptops and battery-powered devices.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'افزودن پروفایل Advertiser و Booster',
        },
        {
          tag: 'new',
          text: 'محاسبه مخارج و هزینه‌ها در کنار ران‌ها',
        },
        {
          tag: 'improved',
          text: 'بازطراحی «افزودن سریع» برای تسریع کار',
        },
        {
          tag: 'improved',
          text: 'بهبود UI/UX، سرعت و مصرف منابع',
        },
        {
          tag: 'improved',
          text: 'بهینه‌سازی برای لپ‌تاپ و دستگاه‌های باتری‌دار',
        },
      ],
    },
  },
  '3.0.2': {
    date: '2026-09-08',
    title: {
      en: "What's New in Checkpoint v3.0.2",
      fa: 'امکانات و تغییرات نسخه ۳.۰.۲',
    },
    summary: {
      en: 'Team payout calculation mode with pot-based splits, enhanced input autocomplete behaviors, context menu navigation refinements, and UI polishing.',
      fa: 'حالت محاسبه درآمد تیمی بر پایه پات کل، بهبود رفتار منوهای انتخابی، اصلاح ناوبری منوهای راست‌کلیک و بهینه‌سازی‌های ظاهری.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: 'Team payout calculation mode: toggle between total pot distribution and direct individual income with automated teammate cuts.',
        },
        {
          tag: 'improved',
          text: 'Disabled intrusive browser autocomplete overlays on source and teammate selection comboboxes.',
        },
        {
          tag: 'improved',
          text: 'Smoother diagonal cursor navigation across nested context menu flyouts with an invisible hover bridge.',
        },
        {
          tag: 'fix',
          text: 'Prevented automatic assignment of "Direct Client" default in records and receipts when source is left empty.',
        },
        {
          tag: 'improved',
          text: 'Refined badge styling, frosted glass borders, and contrast calibration across light and dark modes.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'حالت محاسبه درآمد تیمی: امکان جابجایی بین پات کلی کار و درآمد فردی با محاسبه خودکار سهم هم‌تیمی‌ها.',
        },
        {
          tag: 'improved',
          text: 'غیرفعال‌سازی تکمیل خودکار مرورگر در منوهای انتخاب منبع و هم‌تیمی‌ها جهت جلوگیری از تداخل گزینه‌ها.',
        },
        {
          tag: 'improved',
          text: 'ناوبری روان‌تر ماوس روی زیرمنوهای راست‌کلیک با پل حرکتی شناور.',
        },
        {
          tag: 'fix',
          text: 'جلوگیری از مقداردهی پیش‌فرض "Direct Client" در رکوردها و رسیدها هنگامی که فیلد منبع خالی است.',
        },
        {
          tag: 'improved',
          text: 'بهبود کنتراست و جلوه بصری نشان‌ها و بج‌ها در تم روشن و تاریک.',
        },
      ],
    },
  },
  '3.0.1': {
    date: '2026-09-07',
    title: {
      en: "What's New in Checkpoint v3.0.1",
      fa: 'امکانات و تغییرات نسخه ۳.۰.۱',
    },
    summary: {
      en: 'Interactive WebGPU fluid simulation cockpit backdrop, new official Toman currency symbol, Inter typography calibration, and UX enhancements.',
      fa: 'پس‌زمینه تعاملی و شبیه‌سازی سیال WebGPU در کاکپیت، نماد رسمی جدید ارز تومان، کالیبراسیون تایپوگرافی Inter و ارتقای تجربه کاربری.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: 'Interactive WebGPU fluid simulation backdrop in Cockpit card with real-time cursor dynamics, isotropic 16:9 canvas scaling, and dual-theme palettes.',
        },
        {
          tag: 'new',
          text: 'Official vector Toman (TMN) currency icon across all financial displays, metric pills, cockpit cards, and receipts.',
        },
        {
          tag: 'improved',
          text: 'Integrated Inter Variable font typography for English UI with refined contrast and alignment across all dialogs and navigation.',
        },
        {
          tag: 'improved',
          text: 'Disabled overscroll elastic rubberbanding and horizontal swipe navigation gestures for desktop webview stability.',
        },
        {
          tag: 'improved',
          text: 'Streamlined announcement center with clean slate and refreshed status indicators.',
        },
        {
          tag: 'fix',
          text: 'Fixed date picker alignment, dialog z-index stacking, and contextual action menu overflows.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'پس‌زمینه تعاملی و شبیه‌سازی سیال مبتنی بر WebGPU در بخش کاکپیت با امواج پویا هنگام حرکت نشانگر ماوس و تنظیم خودکار کنتراست تم تاریک و روشن.',
        },
        {
          tag: 'new',
          text: 'آیکون و نشان وکتور رسمی ارز تومان (TMN) در تمام بخش‌های مالی، کارت‌های کاکپیت، مبالغ کل و رسیدها.',
        },
        {
          tag: 'improved',
          text: 'ادغام فونت استاندارد Inter Variable برای زبان انگلیسی با کنتراست دقیق و هماهنگی فونت‌ها در تمامی پنجره‌ها.',
        },
        {
          tag: 'improved',
          text: 'غیرفعال‌سازی ژست‌های حرکتی بازگشت به صفحه قبل و کشسانی اسکرول در محیط دسکتاپ جهت پایداری پنجره.',
        },
        {
          tag: 'improved',
          text: 'پاک‌سازی و بازنشانی پیام‌های مرکز اطلاعیه‌ها به وضعیت جدید.',
        },
        {
          tag: 'fix',
          text: 'اصلاح چینش تقویم، ترتیب نمایش لایه‌ها (z-index) در پنجره‌ها و جلوگیری از سرریز منوی عملیات کارها.',
        },
      ],
    },
  },
  '3.0.0': {
    date: '2026-09-07',
    title: {
      en: "What's New in Checkpoint v3.0.0",
      fa: 'امکانات و تغییرات نسخه ۳.۰.۰',
    },
    summary: {
      en: 'Major upgrade introducing custom work categories, Failed status with lost revenue analytics, desktop context menus, image cropper modal, and enhanced cockpit visualizations.',
      fa: 'ارتقای بزرگ با افزودن دسته‌بندی‌های سفارشی، وضعیت ناموفق (Failed) با تحلیل درآمدهای از دست رفته، منوی کلیک راست دسکتاپ، مدال برش تصاویر و جلوه‌های بصری پیشرفته کاکپیت.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: 'Added custom Category management system with color presets, dynamic filtering in Ledger, and safe migration on deletion.',
        },
        {
          tag: 'new',
          text: 'Added "Failed" status lifecycle support across ledger, excluding cancelled/failed tasks from net earnings and tracking lost revenue in Analytics.',
        },
        {
          tag: 'new',
          text: 'Added native desktop Context Menu on ledger rows for quick actions (edit, duplicate, copy details, change status, delete).',
        },
        {
          tag: 'new',
          text: 'Added Image Cropper modal for profile avatars and receipt attachments with zoom, pan, and custom aspect ratio controls.',
        },
        {
          tag: 'improved',
          text: 'Upgraded Cockpit visual layer with high-performance status gradient and hardware-accelerated dot matrix background.',
        },
        {
          tag: 'improved',
          text: 'Refined dual-theme consistency and micro-interactions across all modals, dialogs, and navigation elements.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'افزودن سیستم مدیریت دسته‌بندی‌های سفارشی با پالت‌های رنگی، فیلتر پویا در دفتر کل و مهاجرت ایمن هنگام حذف.',
        },
        {
          tag: 'new',
          text: 'افزودن وضعیت «ناموفق» (Failed) به چرخه کارها، کسر خودکار از درآمد خالص و نمایش درآمد از دست رفته در بخش تحلیل و آمار.',
        },
        {
          tag: 'new',
          text: 'افزودن منوی راست‌کلیک (Context Menu) برای کارها جهت ویرایش سریع، کپی، تغییر وضعیت و حذف.',
        },
        {
          tag: 'new',
          text: 'افزودن مدال برش و تنظیم تصویر (Image Cropper) برای آواتار و پیوست‌ها با بزرگ‌نمایی و کنترل نسبت تصویر.',
        },
        {
          tag: 'improved',
          text: 'ارتقای بخش کاکپیت با گرادیان وضعیت بهینه‌سازی‌شده و پس‌زمینه ماتریکس نقطه‌ای مبتنی بر شتاب‌دهنده گرافیکی.',
        },
        {
          tag: 'improved',
          text: 'بهبود یکپارچگی تم‌های تاریک و روشن و تعاملات ظریف در تمامی پنجره‌ها و بخش‌های برنامه.',
        },
      ],
    },
  },
  '2.5.1': {
    date: '2026-09-05',
    title: {
      en: "What's New in Checkpoint v2.5.1",
      fa: 'امکانات و تغییرات نسخه ۲.۵.۱',
    },
    summary: {
      en: 'App-aware deep linking for Discord, Telegram, and Steam, refined monochromatic aesthetics, and cockpit ambient visual updates.',
      fa: 'لینک‌دهی هوشمند درون‌برنامه‌ای برای دیسکورد، تلگرام و استیم، کالیبراسیون کنتراست مونوکروم و انیمیشن محیطی کاکپیت.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: 'Added app-aware deep link detection for Discord, Telegram, and Steam with native desktop application launching and web fallback.',
        },
        {
          tag: 'new',
          text: 'Added smart platform badges and custom vector icons for Google Sheets, GitHub, Steam, Discord, and Telegram in work items and receipts.',
        },
        {
          tag: 'improved',
          text: 'Calibrated soft monochromatic palette across light and dark modes, eliminating stark contrasts and improving visual hierarchy.',
        },
        {
          tag: 'improved',
          text: 'Added GPU-accelerated monochromatic ambient gradient rotation around the cockpit Total Income section.',
        },
        {
          tag: 'improved',
          text: 'Enhanced tooltip positioning, origin anchoring, and toggle switch styling in paper-white light theme.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'افزودن تشخیص هوشمند لینک‌ها برای دیسکورد، تلگرام و استیم با قابلیت باز شدن مستقیم در اپلیکیشن دسکتاپ و بازگشت خودکار به مرورگر.',
        },
        {
          tag: 'new',
          text: 'افزودن نشان‌ها و آیکون‌های وکتور اختصاصی برای گوگل شیت، گیت‌هاب، استیم، دیسکورد و تلگرام در کارها و رسیدها.',
        },
        {
          tag: 'improved',
          text: 'کالیبراسیون کنتراست رنگ‌های زینک در تم تاریک و روشن برای حذف تضادهای تند و ارتقای سلسله‌مراتب بصری.',
        },
        {
          tag: 'improved',
          text: 'افزودن گرادیان محیطی مونوکروم با چرخش نرم و بدون افت فریم بر روی بخش مجموع درآمد کاکپیت.',
        },
        {
          tag: 'improved',
          text: 'بهبود لنگراندازی و موقعیت تول‌تیپ‌ها و استایل سوئیچ‌های تنظیمات در تم روشن.',
        },
      ],
    },
  },
  '2.5.0': {
    date: '2026-09-05',
    title: {
      en: "What's New in Checkpoint v2.5.0",
      fa: 'امکانات و تغییرات نسخه ۲.۵.۰',
    },
    summary: {
      en: 'Added Light mode support, improved application performance and smoothness, improved animations, upgraded UI & UX, and added link support for Works.',
      fa: 'پشتیبانی از حالت روشن (Light Mode)، بهبود کارایی و روان بودن برنامه، انیمیشن‌های نرم‌تر، ارتقای رابط و تجربه کاربری (UI & UX)، و افزودن پشتیبانی از لینک برای کارها.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: 'Added Light mode support with automatic next-themes integration, high-contrast monochrome typography, and instant theme toggling.',
        },
        {
          tag: 'new',
          text: 'Added link support for Works with quick external link buttons and URL validation.',
        },
        {
          tag: 'improved',
          text: 'Improved application performance and smoothness across all views, modals, and local SQLite database queries.',
        },
        {
          tag: 'improved',
          text: 'Improved animations and spring motion transitions across modals, dialogs, drawers, and tabs.',
        },
        {
          tag: 'improved',
          text: 'Upgraded UI & UX with refined spacing, responsive mobile navigation, and polished light/dark theme contrast.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'پشتیبانی کامل از حالت روشن (Light Mode) با هماهنگی آنی و کنتراست مونوکروماتیک دقیق در تمام صفحات.',
        },
        {
          tag: 'new',
          text: 'افزودن قابلیت ثبت لینک برای کارها و دسترسی سریع با یک کلیک.',
        },
        {
          tag: 'improved',
          text: 'بهبود چشمگیر عملکرد و روان بودن اجرای برنامه در تمامی نماها و پرس‌وجوهای دیتابیس محلی SQLite.',
        },
        {
          tag: 'improved',
          text: 'بهبود انیمیشن‌ها و نرم‌تر شدن ترنزیشن‌های حرکتی در پنجره‌ها، کشوها و تب‌های ناوبری.',
        },
        {
          tag: 'improved',
          text: 'ارتقای ظاهر و تجربه کاربری (UI & UX) با فاصله‌گذاری‌های استاندارد، ناوبری ریسپانسیو و کنتراست بهینه.',
        },
      ],
    },
  },
  '2.4.3': {
    date: '2026-08-28',
    title: {
      en: "What's New in Checkpoint v2.4.3",
      fa: 'امکانات و تغییرات نسخه ۲.۴.۳',
    },
    summary: {
      en: 'Fixed settings persistence across application restarts, unified dual-tier storage (localStorage + SQLite), and enhanced JSON backup portability.',
      fa: 'رفع مشکل ماندگاری تنظیمات پس از راه‌اندازی مجدد برنامه، یکپارچه‌سازی حافظه محلی و دیتابیس SQLite، و ارتقای خروجی پشتیبان JSON.',
    },
    items: {
      en: [
        {
          tag: 'fix',
          text: 'Fixed Close to Tray, Minimize to Tray, and Scheduled Backups resetting to defaults upon application restart.',
        },
        {
          tag: 'improved',
          text: 'Unified all user settings (language, currency, analytics timeframe, bookmarks, and teammates) across synchronous localStorage and durable SQLite storage.',
        },
        {
          tag: 'improved',
          text: 'Enhanced full JSON backup and restore to include custom sources, teammates crew, and preferences with 100% backward compatibility.',
        },
      ],
      fa: [
        {
          tag: 'fix',
          text: 'رفع مشکل بازنشانی گزینه‌های بستن به سیستم‌تری، مینیمایز، و پشتیبان‌گیری خودکار زمان‌بندی‌شده پس از بستن و باز کردن برنامه.',
        },
        {
          tag: 'improved',
          text: 'یکپارچه‌سازی ذخیره‌سازی تمام تنظیمات (زبان، ارز پیش‌فرض، بازه زمانی نمودارها، سورس‌ها و هم‌تیمی‌ها) در دیتابیس پایدار SQLite.',
        },
        {
          tag: 'improved',
          text: 'افزودن سورس‌ها، هم‌تیمی‌ها و تنظیمات شخصی‌سازی به فایل پشتیبان JSON با حفظ کامل سازگاری با نسخه‌های پیشین.',
        },
      ],
    },
  },
  '2.4.1': {
    date: '2026-08-27',
    title: {
      en: "What's New in Checkpoint v2.4.1",
      fa: 'امکانات و تغییرات نسخه ۲.۴.۱',
    },
    summary: {
      en: 'Multi-action announcements with direct downloads, full Persian & RTL support, Shamsi calendar, and automated backups.',
      fa: 'پشتیبانی از اعلان‌های چنددکمه‌ای و دانلود مستقیم، زبان فارسی و راست‌چین، تقویم شمسی و پشتیبان‌گیری خودکار.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: 'Interactive multi-action announcement feed with one-click GitHub link sharing and direct .exe installer download.',
        },
        {
          tag: 'new',
          text: 'Full Persian (Farsi) & RTL layout support with native IRANYekan typography and instant language switcher in Settings.',
        },
        {
          tag: 'new',
          text: 'Interactive Solar Hijri (Shamsi / Jalali) calendar picker with quick presets (Now, Today, Yesterday) and localized formatting.',
        },
        {
          tag: 'new',
          text: 'Automated local folder backups with custom directory selector, retention rotation (keep 5 to 20), and smart change detection.',
        },
        {
          tag: 'new',
          text: "Version-specific 'What's New' release notes with categorized badges (NEW, IMPROVED, FIX) directly in the Notification Center.",
        },
        {
          tag: 'improved',
          text: 'Pre-update download dialog now parses and displays structured changelogs before downloading new releases.',
        },
        {
          tag: 'improved',
          text: 'Optimized 4K screenshot proof compression for instant proof attachments and lighter SQLite storage.',
        },
        {
          tag: 'fix',
          text: 'Preserved unread/read notification flags and dismissed states across desktop application restarts.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'پشتیبانی از اعلان‌های تعاملی با قابلیت کپی سریع لینک گیت‌هاب و دکمه اختصاصی دانلود فایل نصبی ویندوز.',
        },
        {
          tag: 'new',
          text: 'پشتیبانی کامل از زبان فارسی و چینش راست‌چین (RTL) با فونت رسمی ایران‌یکان و سوییچر سریع در تنظیمات.',
        },
        {
          tag: 'new',
          text: 'تقویم و انتخاب‌گر اختصاصی تاریخ شمسی (خورشیدی) به همراه میانبرهای زمانی (اکنون، امروز، دیروز).',
        },
        {
          tag: 'new',
          text: 'پشتیبان‌گیری خودکار زمان‌بندی‌شده در پوشه دلخواه با مدیریت چرخش نسخه‌ها (۵ تا ۲۰ نسخه) و فینگرپرینت هوشمند تغییرات.',
        },
        {
          tag: 'new',
          text: 'سیستم نمایش تغییرات هر نسخه با برچسب‌های تفکیک‌شده (جدید، بهبود، رفع باگ) در مرکز اعلان‌ها.',
        },
        {
          tag: 'improved',
          text: 'فرمت‌بندی و نمایش ساختاریافته یادداشت‌های انتشار قبل از تایید دانلود در پنجره به‌روزرسانی.',
        },
        {
          tag: 'improved',
          text: 'فشرده‌سازی خودکار و بهینه‌سازی تصاویر فاکتور و اسکرین‌شات‌های 4K جهت افزایش چشمگیر سرعت برنامه و سبکی دیتابیس.',
        },
        {
          tag: 'fix',
          text: 'حفظ دقیق وضعیت پیام‌های خوانده‌شده و ردشده در مرکز اعلان‌ها پس از راه‌اندازی مجدد برنامه.',
        },
      ],
    },
  },
  '2.4.0': {
    date: '2026-08-27',
    title: {
      en: "What's New in Checkpoint v2.4.0",
      fa: 'امکانات و تغییرات نسخه ۲.۴.۰',
    },
    summary: {
      en: 'Full Persian & RTL support, Solar Hijri (Shamsi) calendar, automated local backups, and Notification Center release notes.',
      fa: 'پشتیبانی کامل از زبان فارسی و راست‌چین، تقویم خورشیدی شمسی، پشتیبان‌گیری خودکار و سیستم گزارش تغییرات در مرکز اعلان‌ها.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: 'Full Persian (Farsi) & RTL layout support with native IRANYekan typography and instant language switcher in Settings.',
        },
        {
          tag: 'new',
          text: 'Interactive Solar Hijri (Shamsi / Jalali) calendar picker with quick presets (Now, Today, Yesterday) and localized formatting.',
        },
        {
          tag: 'new',
          text: 'Automated local folder backups with custom directory selector, retention rotation (keep 5 to 20), and smart change detection.',
        },
        {
          tag: 'new',
          text: "Version-specific 'What's New' release notes with categorized badges (NEW, IMPROVED, FIX) directly in the Notification Center.",
        },
        {
          tag: 'improved',
          text: 'Pre-update download dialog now parses and displays structured changelogs before downloading new releases.',
        },
        {
          tag: 'improved',
          text: 'Optimized 4K screenshot proof compression for instant proof attachments and lighter SQLite storage.',
        },
        {
          tag: 'improved',
          text: 'High-density UI polish, smoother dialog transitions, and enhanced keyboard shortcut responsiveness (N, Q, C, S).',
        },
        {
          tag: 'fix',
          text: 'Preserved unread/read notification flags and dismissed states across desktop application restarts.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'پشتیبانی کامل از زبان فارسی و چینش راست‌چین (RTL) با فونت رسمی ایران‌یکان و سوییچر سریع در تنظیمات.',
        },
        {
          tag: 'new',
          text: 'تقویم و انتخاب‌گر اختصاصی تاریخ شمسی (خورشیدی) به همراه میانبرهای زمانی (اکنون، امروز، دیروز).',
        },
        {
          tag: 'new',
          text: 'پشتیبان‌گیری خودکار زمان‌بندی‌شده در پوشه دلخواه با مدیریت چرخش نسخه‌ها (۵ تا ۲۰ نسخه) و فینگرپرینت هوشمند تغییرات.',
        },
        {
          tag: 'new',
          text: 'سیستم نمایش تغییرات هر نسخه با برچسب‌های تفکیک‌شده (جدید، بهبود، رفع باگ) در مرکز اعلان‌ها.',
        },
        {
          tag: 'improved',
          text: 'فرمت‌بندی و نمایش ساختاریافته یادداشت‌های انتشار قبل از تایید دانلود در پنجره به‌روزرسانی.',
        },
        {
          tag: 'improved',
          text: 'فشرده‌سازی خودکار و بهینه‌سازی تصاویر فاکتور و اسکرین‌شات‌های 4K جهت افزایش چشمگیر سرعت برنامه و سبکی دیتابیس.',
        },
        {
          tag: 'improved',
          text: 'بهبود تراکم و ظاهر رابط کاربری، انیمیشن‌های مینیمال پنجره‌ها و عملکرد سریع‌تر کلیدهای میانبر (N, Q, C, S).',
        },
        {
          tag: 'fix',
          text: 'حفظ دقیق وضعیت پیام‌های خوانده‌شده و ردشده در مرکز اعلان‌ها پس از راه‌اندازی مجدد برنامه.',
        },
      ],
    },
  },
  '2.3.3': {
    date: '2026-08-27',
    title: {
      en: "What's New in Checkpoint v2.3.3",
      fa: 'امکانات و تغییرات نسخه ۲.۳.۳',
    },
    summary: {
      en: 'Categorized release notes, enhanced notification center, and UI optimizations.',
      fa: 'لیست تغییرات دسته‌بندی‌شده، ارتقای مرکز اعلان‌ها و بهبودهای رابط کاربری.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: "Rich 'What's New' release notes with categorized badges directly in the Notification Center.",
        },
        {
          tag: 'improved',
          text: 'Pre-update download dialog now parses and displays structured changelogs before updating.',
        },
        {
          tag: 'improved',
          text: 'Cumulative update aggregation when skipping intermediate versions.',
        },
        {
          tag: 'fix',
          text: 'Preserved read states and dismissal across desktop app relaunches.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'نمایش لیست تغییرات و ویژگی‌های جدید هر نسخه با برچسب‌های تفکیک‌شده در مرکز اعلان‌ها.',
        },
        {
          tag: 'improved',
          text: 'فرمت‌بندی و نمایش ساختاریافته یادداشت‌های انتشار پیش از شروع دانلود به‌روزرسانی.',
        },
        {
          tag: 'improved',
          text: 'جمع‌آوری هوشمند تمام تغییرات نسخه‌های میانی در صورت ارتقای چند نسخه به‌صورت یکجا.',
        },
        {
          tag: 'fix',
          text: 'حفظ دقیق وضعیت پیام‌های خوانده‌شده و بسته‌شده پس از راه‌اندازی مجدد برنامه.',
        },
      ],
    },
  },
  '2.3.0': {
    date: '2026-08-25',
    title: {
      en: "What's New in Checkpoint v2.3.0",
      fa: 'امکانات و تغییرات نسخه ۲.۳.۰',
    },
    summary: {
      en: 'Automated folder backups, persistent Notification Center, and screenshot optimizations.',
      fa: 'پشتیبان‌گیری خودکار زمان‌بندی‌شده، مرکز اعلان‌های محلی و بهینه‌سازی ذخیره تصاویر.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: 'Scheduled folder backups with custom directory selection and retention limits (5 to 20 backups).',
        },
        {
          tag: 'new',
          text: 'Persistent local Notification Center with filtered tabs for Releases and Announcements.',
        },
        {
          tag: 'improved',
          text: 'Optimized 4K screenshot compression for instant proof attachments and smaller SQLite size.',
        },
        {
          tag: 'improved',
          text: 'Added quick gold ratio preset chips and interactive guide in the top bar.',
        },
        {
          tag: 'fix',
          text: 'Fixed window drag handling and click-through issues on custom titlebar controls.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'پشتیبان‌گیری خودکار در پوشه دلخواه با قابلیت مدیریت تعداد نسخه‌ها (۵ تا ۲۰ نسخه اخیر).',
        },
        {
          tag: 'new',
          text: 'مرکز اعلان‌های اختصاصی و پایدار با فیلترهای رویدادها، نسخه‌ها و اطلاعیه‌ها.',
        },
        {
          tag: 'improved',
          text: 'فشرده‌سازی هوشمند اسکرین‌شات‌های 4K جهت سبک‌سازی دیتابیس و افزایش سرعت برنامه.',
        },
        {
          tag: 'improved',
          text: 'دکمه‌های انتخاب سریع نرخ گلد روزانه به همراه راهنمای تعاملی در نوار بالا.',
        },
        {
          tag: 'fix',
          text: 'اصلاح عملکرد درگ پنجره و رفع تداخل کلیک در نوار ابزار سفارشی.',
        },
      ],
    },
  },
  '2.2.0': {
    date: '2026-08-20',
    title: {
      en: "What's New in Checkpoint v2.2.0",
      fa: 'امکانات و تغییرات نسخه ۲.۲.۰',
    },
    summary: {
      en: 'System tray integration, background minimizing, and fast shortcuts.',
      fa: 'پشتیبانی از System Tray، مینیمایز در پس‌زمینه و کلیدهای میانبر سریع.',
    },
    items: {
      en: [
        {
          tag: 'new',
          text: 'System Tray support with background minimization and Quick Add context menu.',
        },
        {
          tag: 'new',
          text: 'Added Quick Add modal with global keyboard shortcut (Q).',
        },
        {
          tag: 'improved',
          text: 'High-density ledger view with instant inline teammate and source auto-complete.',
        },
        {
          tag: 'fix',
          text: 'Resolved date filter boundary issues in Analytics earnings chart.',
        },
      ],
      fa: [
        {
          tag: 'new',
          text: 'پشتیبانی از System Tray با قابلیت مینیمایز در پس‌زمینه و منوی راست‌کلیک ثبت سریع.',
        },
        {
          tag: 'new',
          text: 'پنجره ثبت سریع کارها با کلید میانبر سراسری (Q).',
        },
        {
          tag: 'improved',
          text: 'نمایش فوق‌العاده فشرده دفتر کل با تکمیل خودکار هوشمند نام هم‌تیمی‌ها و منابع.',
        },
        {
          tag: 'fix',
          text: 'اصلاح بازه زمانی فیلترها در نمودار درآمدهای بخش آمار و تحلیل.',
        },
      ],
    },
  },
};

/**
 * Smart markdown changelog parser for remote GitHub release bodies.
 * Parses lines like:
 *   - [NEW] Added feature ...
 *   - * [Improved] Faster loading ...
 *   - - Fix: Bug in date filter ...
 *   - Regular bullet text
 */
export function parseMarkdownChangelog(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') return [];

  const lines = markdownText.split('\n');
  const items = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Match bullet point formats: -, *, +, •, or 1.
    const bulletMatch = line.match(/^[-*+•\d.]+\s+(.*)$/);
    if (!bulletMatch) continue;

    let content = bulletMatch[1].trim();
    if (!content) continue;

    // Strip any nested bullet markers like '* ' or '- '
    content = content.replace(/^[-*+•]+\s+/, '').trim();

    // Detect tag prefix e.g. [NEW], [IMPROVED], [FIX], New:, Fix:, etc.
    let tag = null;
    let cleanText = content;

    const tagMatch = content.match(/^\[?(NEW|FEATURE|ADDED|IMPROVED|OPTIMIZED|UPDATE|FIX|FIXED|BUGFIX)\]?[:\s-]+(.*)$/i);
    if (tagMatch) {
      const rawTag = tagMatch[1].toUpperCase();
      cleanText = tagMatch[2].trim();

      if (['NEW', 'FEATURE', 'ADDED'].includes(rawTag)) {
        tag = 'new';
      } else if (['IMPROVED', 'OPTIMIZED', 'UPDATE'].includes(rawTag)) {
        tag = 'improved';
      } else if (['FIX', 'FIXED', 'BUGFIX'].includes(rawTag)) {
        tag = 'fix';
      }
    }

    if (cleanText) {
      items.push({ tag, text: cleanText });
    }
  }

  return items;
}

/**
 * Retrieve release notes for a specific version.
 * If rawBody is provided (e.g. from GitHub Release check), parses markdown if not in registry.
 */
export function getReleaseNotesForVersion(version, language = 'en', rawBody = '') {
  const cleanVer = String(version || '').replace(/^v/i, '').trim();
  const lang = language === 'fa' ? 'fa' : 'en';

  const entry = RELEASE_NOTES_REGISTRY[cleanVer];
  if (entry) {
    return {
      version: cleanVer,
      date: entry.date,
      title: entry.title[lang] || entry.title.en,
      summary: entry.summary[lang] || entry.summary.en,
      items: entry.items[lang] || entry.items.en || [],
    };
  }

  // Fallback: parse rawBody if provided
  if (rawBody && typeof rawBody === 'string') {
    const parsedItems = parseMarkdownChangelog(rawBody);
    if (parsedItems.length > 0) {
      return {
        version: cleanVer,
        date: new Date().toISOString().slice(0, 10),
        title: lang === 'fa' ? `تغییرات نسخه ${cleanVer}` : `What's New in Checkpoint v${cleanVer}`,
        summary: lang === 'fa' ? `به‌روزرسانی و ارتقای امکانات به نسخه ${cleanVer}` : `Updates and improvements in version ${cleanVer}.`,
        items: parsedItems,
      };
    }
  }

  // Generic fallback
  return {
    version: cleanVer,
    date: new Date().toISOString().slice(0, 10),
    title: lang === 'fa' ? `به‌روزرسانی به نسخه ${cleanVer}` : `Updated to Checkpoint v${cleanVer}`,
    summary: lang === 'fa' ? 'بهبود عملکرد، پایداری و رفع خطاهای گزارش‌شده.' : 'Performance enhancements, optimizations, and stability improvements.',
    items: [
      {
        tag: 'improved',
        text: lang === 'fa' ? 'بهینه‌سازی عملکرد و پایداری سیستم' : 'General performance and stability improvements',
      },
    ],
  };
}

/**
 * Aggregate release notes across a range of versions (e.g. when jumping from 2.1.0 to 2.3.3).
 * Returns array of release note objects sorted newest first.
 */
export function getAggregatedReleaseNotes(fromVersion, toVersion, language = 'en') {
  const lang = language === 'fa' ? 'fa' : 'en';
  const cleanTo = String(toVersion || '').replace(/^v/i, '').trim();
  const cleanFrom = fromVersion ? String(fromVersion).replace(/^v/i, '').trim() : null;

  const versions = Object.keys(RELEASE_NOTES_REGISTRY).sort((a, b) => compareSemver(b, a));
  const aggregated = [];

  for (const ver of versions) {
    // Only include versions <= toVersion
    if (compareSemver(ver, cleanTo) > 0) continue;

    // Stop if we reached or fell below fromVersion
    if (cleanFrom && compareSemver(ver, cleanFrom) <= 0) break;

    const notes = getReleaseNotesForVersion(ver, lang);
    if (notes) {
      aggregated.push(notes);
    }
  }

  // If no intermediate registry entries matched, return at least the target version notes
  if (aggregated.length === 0) {
    aggregated.push(getReleaseNotesForVersion(cleanTo, lang));
  }

  return aggregated;
}
