// Aangi Associates — Honors & Accolades data
// One RecognitionItem per real event/delegation photo. Never fabricate
// year/location — omit the key if it isn't actually visible in the photo.
//
// interface RecognitionItem {
//   id: string;
//   title: string;
//   category: 'awards' | 'international' | 'domestic';
//   year?: string;
//   location?: string;
//   imageSrc: string;
//   thumbnailSrc: string;
//   caption: string;
// }
//
// Curated from a full survey of the source photo folders (review_pool,
// thumbs, review, Image, frames) — trophy/certificate close-ups excluded
// (those already live in the trophy rail higher up this page), duplicate
// bursts collapsed to one frame per moment. Every entry below was visually
// checked against its own photo file before shipping (one entry from the
// initial survey — a mislabeled "Baku" item that was actually a duplicate
// Ahmedabad stage frame — was dropped rather than shipped with a wrong
// caption).
var RECOGNITION_ITEMS = [
  { id: "md-insignia-senior-business-leader-01", title: "TATA AIA MD Insignia — Senior Business Leader", category: "awards", imageSrc: "assets/img/honors/honors-md-insignia-senior-business-leader-01.jpg", thumbnailSrc: "assets/img/honors/honors-md-insignia-senior-business-leader-01-480.jpg", caption: "Receiving the MD Insignia award on stage as Senior Business Leader for Aangi Associates." },
  { id: "insignia-achievers-summit-welcome-01", title: "MD Insignia — Leaders Achiever's Summit, Season 3", category: "awards", imageSrc: "assets/img/honors/honors-insignia-achievers-summit-welcome-01.jpg", thumbnailSrc: "assets/img/honors/honors-insignia-achievers-summit-welcome-01-480.jpg", caption: "At the MD Insignia Leaders Achiever's Summit Season 3 welcome backdrop." },
  { id: "aangi-associates-congratulations-stage-01", title: "On Stage for Aangi Associates", category: "awards", imageSrc: "assets/img/honors/honors-aangi-associates-congratulations-stage-01.jpg", thumbnailSrc: "assets/img/honors/honors-aangi-associates-congratulations-stage-01-480.jpg", caption: "Congratulated on stage as Aangi Associates, Ahmedabad — Iscon Mall." },
  { id: "baku-i-love-baku-01", title: "Baku Training Conclave 2020 — I Love Baku", category: "international", year: "2020", location: "Baku, Azerbaijan", imageSrc: "assets/img/honors/honors-baku-i-love-baku-01.jpg", thumbnailSrc: "assets/img/honors/honors-baku-i-love-baku-01-480.jpg", caption: "At the \"I Love Baku\" installation during the TATA AIA Baku Training Conclave 2020." },
  { id: "baku-heydar-aliyev-center-01", title: "Heydar Aliyev Center, Baku", category: "international", year: "2020", location: "Baku, Azerbaijan", imageSrc: "assets/img/honors/honors-baku-heydar-aliyev-center-01.jpg", thumbnailSrc: "assets/img/honors/honors-baku-heydar-aliyev-center-01-480.jpg", caption: "Outside the Heydar Aliyev Center in Baku during the training conclave." },
  { id: "regional-agency-awards-stage-01", title: "Regional Agency Awards Night", category: "domestic", imageSrc: "assets/img/honors/honors-regional-agency-awards-stage-01.jpg", thumbnailSrc: "assets/img/honors/honors-regional-agency-awards-stage-01-480.jpg", caption: "On stage presenting a regional agency performance award." },
  { id: "manila-welcome-01", title: "Welcome to Manila", category: "international", location: "Manila, Philippines", imageSrc: "assets/img/honors/honors-manila-welcome-01.jpg", thumbnailSrc: "assets/img/honors/honors-manila-welcome-01-480.jpg", caption: "At the welcome entrance for the MDRT AURA \"Sankalp\" summit in Manila." },
  { id: "red-carpet-backdrop-01", title: "TATA AIA Red Carpet", category: "awards", imageSrc: "assets/img/honors/honors-red-carpet-backdrop-01.jpg", thumbnailSrc: "assets/img/honors/honors-red-carpet-backdrop-01-480.jpg", caption: "On the red carpet at a TATA AIA agency event." },
  { id: "mdrt-aura-summit-season1-01", title: "MDRT AURA Summit, Season 1", category: "domestic", imageSrc: "assets/img/honors/honors-mdrt-aura-summit-season1-01.jpg", thumbnailSrc: "assets/img/honors/honors-mdrt-aura-summit-season1-01-480.jpg", caption: "At the \"Vronautsav\" MDRT AURA Summit Season 1 backdrop." },
  { id: "office-inauguration-ribbon-cutting-01", title: "Office Inauguration", category: "domestic", imageSrc: "assets/img/honors/honors-office-inauguration-ribbon-cutting-01.jpg", thumbnailSrc: "assets/img/honors/honors-office-inauguration-ribbon-cutting-01-480.jpg", caption: "Cutting the ribbon at an Aangi Associates office inauguration." },
  { id: "hongkong-macau-conclave-01", title: "MDRT Premier Training Conclave — Hong Kong-Macau 2024", category: "international", year: "2024", location: "Hong Kong-Macau", imageSrc: "assets/img/honors/honors-hongkong-macau-conclave-01.jpg", thumbnailSrc: "assets/img/honors/honors-hongkong-macau-conclave-01-480.jpg", caption: "At the red-carpet entrance of the MDRT Premier Training Conclave, Hong Kong-Macau 2024." },
  { id: "almaty-training-conclave-01", title: "Almaty Training Conclave 2021", category: "international", year: "2021", location: "Almaty, Kazakhstan", imageSrc: "assets/img/honors/honors-almaty-training-conclave-01.jpg", thumbnailSrc: "assets/img/honors/honors-almaty-training-conclave-01-480.jpg", caption: "On stage at the Almaty Training Conclave as Vaishali Jainikkumar Shah is felicitated." },
  { id: "mdrt-roadshow-2024-01", title: "MDRT Roadshow, January 2024", category: "domestic", year: "2024", imageSrc: "assets/img/honors/honors-mdrt-roadshow-2024-01.jpg", thumbnailSrc: "assets/img/honors/honors-mdrt-roadshow-2024-01-480.jpg", caption: "On stage at the MDRT Roadshow (Jan 2024) as MDRT 1.5 Qualifiers are recognised." },
  { id: "aangi-associates-award-ceremony-02", title: "Award Ceremony — Aangi Associates", category: "domestic", imageSrc: "assets/img/honors/honors-aangi-associates-award-ceremony-02.jpg", thumbnailSrc: "assets/img/honors/honors-aangi-associates-award-ceremony-02-480.jpg", caption: "On stage receiving an award for Aangi Associates, Ahmedabad — Iscon Mall." },
  { id: "dubai-training-conclave-01", title: "Dubai Training Conclave", category: "international", location: "Dubai, UAE", imageSrc: "assets/img/honors/honors-dubai-training-conclave-01.jpg", thumbnailSrc: "assets/img/honors/honors-dubai-training-conclave-01-480.jpg", caption: "At the Dubai Training Conclave welcome standee." },
  { id: "dubai-training-conclave-couple-01", title: "Dubai Training Conclave, with Vaishali Shah", category: "international", location: "Dubai, UAE", imageSrc: "assets/img/honors/honors-dubai-training-conclave-couple-01.jpg", thumbnailSrc: "assets/img/honors/honors-dubai-training-conclave-couple-01-480.jpg", caption: "With Vaishali Jainikkumar Shah at the Dubai Training Conclave standee." },
  { id: "budapest-training-conclave-01", title: "Budapest Training Conclave, MDRT 2022", category: "international", year: "2022", location: "Budapest, Hungary", imageSrc: "assets/img/honors/honors-budapest-training-conclave-01.jpg", thumbnailSrc: "assets/img/honors/honors-budapest-training-conclave-01-480.jpg", caption: "On stage as Vaishali Jainikkumar Shah is congratulated at the Budapest Training Conclave, MDRT 2022." },
];
