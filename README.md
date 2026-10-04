# موقع كتالوج ألعاب PlayStation

مشروع Static خفيف يعمل على GitHub Pages بدون قاعدة بيانات أو Backend.

## الملفات
- `index.html` الموقع العام.
- `styles.css` تصميم الموقع العام.
- `app.js` منطق الموقع العام.
- `games.json` بيانات الألعاب.
- `config.json` اسم الموقع ورقم واتساب.
- `game-manager.html` مدير الألعاب المحلي.
- `manager.css` و`manager.js` تصميم ومنطق المدير.
- `logo.svg` شعار افتراضي.

## التشغيل على GitHub Pages
ارفع جميع الملفات إلى المستودع نفسه، ثم فعّل GitHub Pages.

## التشغيل المحلي
يمكن فتح `index.html` بالنقر المزدوج. بسبب قيود المتصفح على `file://` سيظهر لك مربع يطلب اختيار `games.json` و`config.json` مرة واحدة. هذا سلوك طبيعي. على GitHub Pages يتم تحميل الملفين تلقائيًا.

يفضل أيضًا تشغيل المشروع محليًا عبر خادم بسيط مثل VS Code Live Server أو `python -m http.server`، وعندها سيقرأ `games.json` و`config.json` تلقائيًا.

## واتساب
عدل `whatsappNumber` في `config.json` إلى الرقم الدولي بدون `+` أو مسافات.

## صور الألعاب
المقاس الأساسي: **286 × 350 px**. الأفضل تجهيز الصور بهذا المقاس قبل إضافتها.

## JSON
كل لعبة: `id`, `name`, `platform`, `image`, `size`, `releaseYear`, `genre`، مع `notes` اختياري.

## قواعد المنصات
- PS4: ألعاب PS4 فقط.
- PS5: ألعاب PS4 وPS5.
