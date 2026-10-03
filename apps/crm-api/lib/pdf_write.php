<?php
declare(strict_types=1);

// A minimal, pure-PHP PDF *writer* — same zero-dependency rationale as
// lib/pdf_text.php (the reader): no Imagick, no exec, no Composer
// package. Purpose-built for exactly one document (the daily intimation
// digest, see cron/daily_intimation.php and intimations.php's ?pdf=1) —
// single A4 page, built-in Helvetica only (no font embedding needed), one
// row per due item with a real clickable /Subtype /Link annotation per
// row pointing at that item's dispatch-token redirect URL.
//
// This is NOT a general-purpose PDF library: no multi-page flow, no image
// support, no font embedding. If the digest ever needs more than
// PDF_MAX_ROWS items on one page, it truncates with a visible note rather
// than attempting multi-page layout — an honest, documented limit rather
// than silently-buggy pagination.

const PDF_MAX_ROWS = 28; // fits one A4 page at the row height used below

function pdf_write_escape_text(string $s): string
{
    // Built-in Helvetica only supports WinAnsiEncoding's single-byte
    // repertoire — transliterate/drop anything outside it rather than emit
    // bytes the font can't render. Then escape the 3 characters PDF literal
    // strings treat specially.
    $s = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $s);
    if ($s === false) $s = '?';
    return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $s);
}

/**
 * @param list<array{kind:string,client_name:string,product_type:?string,renewal_date:?string,redirect_link:string}> $items
 */
function pdf_write_intimation_digest(string $forDate, array $items): string
{
    $pageWidth = 595;  // A4 in points
    $pageHeight = 842;
    $marginX = 40;
    $rowHeight = 26;
    $topY = 790;

    $truncated = count($items) > PDF_MAX_ROWS;
    $shown = array_slice($items, 0, PDF_MAX_ROWS);

    // ---- Build the page content stream (text + button rectangles) --------
    $content = "BT /F2 16 Tf $marginX " . ($topY) . " Td (" . pdf_write_escape_text('Aangi Associates - Daily Intimation Digest') . ") Tj ET\n";
    $content .= "BT /F1 10 Tf $marginX " . ($topY - 20) . " Td (" . pdf_write_escape_text("For $forDate - " . count($items) . ' item(s)' . ($truncated ? ' (showing first ' . PDF_MAX_ROWS . ' - see the full list in the CRM Intimations page)' : '')) . ") Tj ET\n";

    $annots = [];
    $y = $topY - 50;
    foreach ($shown as $item) {
        $label = $item['kind'] === 'birthday'
            ? 'Birthday - ' . $item['client_name']
            : 'Renewal - ' . $item['client_name'];
        $detail = $item['kind'] === 'birthday'
            ? 'Today is their birthday.'
            : trim(($item['product_type'] ?? 'Policy') . ' - due ' . ($item['renewal_date'] ? date('d M Y', strtotime($item['renewal_date'])) : '-'));

        $content .= "BT /F2 11 Tf $marginX " . $y . " Td (" . pdf_write_escape_text($label) . ") Tj ET\n";
        $content .= "BT /F1 9 Tf $marginX " . ($y - 12) . " Td (" . pdf_write_escape_text($detail) . ") Tj ET\n";

        // The "button": a bordered box on the right, drawn AND covered by a
        // Link annotation with the exact same rect — the drawing is what
        // makes it look like a button, the annotation is what makes it
        // actually clickable.
        $btnX1 = $pageWidth - $marginX - 110;
        $btnX2 = $pageWidth - $marginX;
        $btnY1 = $y - 14;
        $btnY2 = $y + 12;
        $content .= "1 0.95 0.85 rg $btnX1 $btnY1 " . ($btnX2 - $btnX1) . ' ' . ($btnY2 - $btnY1) . " re f\n";
        $content .= "0.56 0.43 0.15 RG $btnX1 $btnY1 " . ($btnX2 - $btnX1) . ' ' . ($btnY2 - $btnY1) . " re S\n";
        $content .= "0.56 0.43 0.15 rg BT /F2 9 Tf " . ($btnX1 + 12) . ' ' . ($y - 2) . " Td (Send via WhatsApp ->) Tj ET\n";

        $annots[] = ['rect' => [$btnX1, $btnY1, $btnX2, $btnY2], 'uri' => $item['redirect_link']];

        $y -= $rowHeight;
    }

    if ($truncated) {
        $content .= "BT /F1 9 Tf $marginX " . ($y - 6) . " Td (" . pdf_write_escape_text('+ ' . (count($items) - PDF_MAX_ROWS) . ' more item(s) not shown - open the Intimations page in the CRM for the complete list.') . ") Tj ET\n";
    }

    // ---- Assemble the object graph -----------------------------------------
    // Object numbers: 1 Catalog, 2 Pages, 3 Page, 4 Font(Helvetica),
    // 5 Font(Helvetica-Bold), 6 Content stream, 7..7+n-1 Link annotations.
    $annotRefs = [];
    $annotObjs = [];
    $nextId = 7;
    foreach ($annots as $a) {
        [$x1, $y1, $x2, $y2] = $a['rect'];
        $uri = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $a['uri']);
        $annotObjs[] = "$nextId 0 obj\n<< /Type /Annot /Subtype /Link /Rect [$x1 $y1 $x2 $y2] /Border [0 0 0] /A << /Type /Action /S /URI /URI ($uri) >> >>\nendobj\n";
        $annotRefs[] = "$nextId 0 R";
        $nextId++;
    }
    $annotsArray = $annotRefs ? '[' . implode(' ', $annotRefs) . ']' : '[]';

    $objects = [];
    $objects[1] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
    $objects[2] = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
    $objects[3] = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 $pageWidth $pageHeight] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R /Annots $annotsArray >>\nendobj\n";
    $objects[4] = "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n";
    $objects[5] = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n";
    $objects[6] = "6 0 obj\n<< /Length " . strlen($content) . " >>\nstream\n$content" . "endstream\nendobj\n";
    foreach ($annotObjs as $i => $obj) $objects[7 + $i] = $obj;

    $totalObjects = $nextId - 1;

    // ---- Serialize, tracking each object's byte offset for the xref table --
    $out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; // header + binary-marker comment (standard practice, signals "has binary content" to transfer tools)
    $offsets = [0 => 0]; // object 0 is the free-list head, offset 0 by convention
    for ($i = 1; $i <= $totalObjects; $i++) {
        $offsets[$i] = strlen($out);
        $out .= $objects[$i];
    }

    $xrefOffset = strlen($out);
    $out .= "xref\n0 " . ($totalObjects + 1) . "\n";
    $out .= "0000000000 65535 f\r\n";
    for ($i = 1; $i <= $totalObjects; $i++) {
        $out .= sprintf("%010d %05d n\r\n", $offsets[$i], 0);
    }
    $out .= "trailer\n<< /Size " . ($totalObjects + 1) . " /Root 1 0 R >>\nstartxref\n$xrefOffset\n%%EOF";

    return $out;
}

// ---------------------------------------------------------------------------
// Generic multi-page assembler, added for policy_summary.php's 2-page
// profile+policy-detail PDF (see below) — pdf_write_intimation_digest()
// above stays hardcoded to one page since that's all it has ever needed;
// this is deliberately a separate, general building block rather than a
// rewrite of already-shipped, already-tested code.

/**
 * @param list<array{content:string, annots?:list<array{rect:array{0:float,1:float,2:float,3:float}, uri:string}>}> $pages
 * @param array<string, array{jpeg:string, width:int, height:int}> $images Pre-decoded JPEG bytes, keyed by the XObject name used in page content (e.g. "/ImLogo Do"). Every page gets every image in its Resources dict, whether that page's content stream actually paints it or not — harmless, and far simpler than tracking per-page usage.
 */
function pdf_assemble_document(array $pages, array $images = [], int $pageWidth = 595, int $pageHeight = 842): string
{
    $objects = [];
    $pageRefs = [];
    $nextId = 5; // 1 Catalog, 2 Pages, 3 Font(Helvetica), 4 Font(Helvetica-Bold)

    $imageIds = [];
    foreach ($images as $name => $img) {
        $id = $nextId++;
        $imageIds[$name] = $id;
        $objects[$id] = "$id 0 obj\n<< /Type /XObject /Subtype /Image /Width {$img['width']} /Height {$img['height']} "
            . "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " . strlen($img['jpeg']) . " >>\nstream\n"
            . $img['jpeg'] . "\nendstream\nendobj\n";
    }
    $xobjectDict = '';
    foreach ($imageIds as $name => $id) $xobjectDict .= "/$name $id 0 R ";

    foreach ($pages as $page) {
        $pageId = $nextId++;
        $contentId = $nextId++;
        $annotRefs = [];
        foreach ($page['annots'] ?? [] as $a) {
            $annotId = $nextId++;
            [$x1, $y1, $x2, $y2] = $a['rect'];
            $uri = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $a['uri']);
            $objects[$annotId] = "$annotId 0 obj\n<< /Type /Annot /Subtype /Link /Rect [$x1 $y1 $x2 $y2] /Border [0 0 0] /A << /Type /Action /S /URI /URI ($uri) >> >>\nendobj\n";
            $annotRefs[] = "$annotId 0 R";
        }
        $annotsArray = $annotRefs ? '[' . implode(' ', $annotRefs) . ']' : '[]';
        $content = $page['content'];
        $resources = "<< /Font << /F1 3 0 R /F2 4 0 R >>" . ($xobjectDict !== '' ? " /XObject << $xobjectDict>>" : '') . " >>";
        $objects[$pageId] = "$pageId 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 $pageWidth $pageHeight] /Resources $resources /Contents $contentId 0 R /Annots $annotsArray >>\nendobj\n";
        $objects[$contentId] = "$contentId 0 obj\n<< /Length " . strlen($content) . " >>\nstream\n$content" . "endstream\nendobj\n";
        $pageRefs[] = "$pageId 0 R";
    }

    $totalObjects = $nextId - 1;
    $objects[1] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
    $objects[2] = "2 0 obj\n<< /Type /Pages /Kids [" . implode(' ', $pageRefs) . "] /Count " . count($pages) . " >>\nendobj\n";
    $objects[3] = "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n";
    $objects[4] = "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n";

    $out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    $offsets = [0 => 0];
    for ($i = 1; $i <= $totalObjects; $i++) {
        $offsets[$i] = strlen($out);
        $out .= $objects[$i];
    }
    $xrefOffset = strlen($out);
    $out .= "xref\n0 " . ($totalObjects + 1) . "\n";
    $out .= "0000000000 65535 f\r\n";
    for ($i = 1; $i <= $totalObjects; $i++) {
        $out .= sprintf("%010d %05d n\r\n", $offsets[$i], 0);
    }
    $out .= "trailer\n<< /Size " . ($totalObjects + 1) . " /Root 1 0 R >>\nstartxref\n$xrefOffset\n%%EOF";
    return $out;
}

// Brand colors (packages/ui/tokens.css light values), as "r g b" operand
// strings (0-1 floats) for PDF's rg/RG operators.
const PDF_BRAND = [
    'navy' => '0.059 0.165 0.290',
    'crimson' => '0.612 0.110 0.188',
    'gold' => '0.561 0.435 0.149',
    'text' => '0.106 0.137 0.200',
    'text_soft' => '0.357 0.384 0.447',
    'surface2' => '0.937 0.910 0.847',
    'line' => '0.882 0.851 0.765',
    'on_navy' => '0.965 0.953 0.918',
];

/** No real font metrics in pure PHP — wraps by an approximate average Helvetica character width rather than pixel-perfect measurement. Good enough for prose blurbs/disclaimers, same honest-approximation spirit as the rest of this file. */
function pdf_wrap_text(string $text, float $maxWidthPts, float $fontSize): array
{
    $avgCharWidth = $fontSize * 0.52;
    $maxChars = max(10, (int) floor($maxWidthPts / $avgCharWidth));
    $wrapped = wordwrap($text, $maxChars, "\n", false);
    return explode("\n", $wrapped);
}

function pdf_format_inr(?float $amount): string
{
    if ($amount === null) return 'Rs. -';
    $n = (int) round($amount);
    $str = (string) abs($n);
    if (strlen($str) > 3) {
        $last3 = substr($str, -3);
        $rest = substr($str, 0, -3);
        $rest = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest);
        $str = $rest . ',' . $last3;
    }
    return 'Rs. ' . ($n < 0 ? '-' : '') . $str;
}

function pdf_format_date(?string $iso): string
{
    if (!$iso) return '-';
    $t = strtotime($iso);
    return $t ? date('d M Y', $t) : '-';
}

/**
 * Reads a JPEG straight off disk — PDF's /DCTDecode filter accepts raw
 * JPEG byte streams directly, no re-encoding needed, so this is just a
 * file read + getimagesize() (a core PHP function, no extension required)
 * for the /Width and /Height the Image XObject dict needs. Returns null
 * for anything that isn't actually a JPEG so a caller can degrade
 * honestly instead of embedding bytes the DCTDecode filter can't parse.
 */
function pdf_load_jpeg(string $path): ?array
{
    if (!is_file($path)) return null;
    $info = @getimagesize($path);
    if ($info === false || $info[2] !== IMAGETYPE_JPEG) return null;
    $bytes = @file_get_contents($path);
    if ($bytes === false) return null;
    return ['jpeg' => $bytes, 'width' => $info[0], 'height' => $info[1]];
}

/**
 * This project's logo is a transparent PNG (RGBA) — PDF can embed that
 * too, but only via a separate alpha-channel SMask image built by hand-
 * unfiltering the PNG's own scanline compression, real complexity for a
 * single logo. Imagick is confirmed installed on this project's actual
 * Hostinger account (checked directly, the same way the Ghostscript
 * integration above was) even though this codebase otherwise avoids it
 * — flattening the transparent areas onto a solid background and
 * re-exporting as a plain JPEG sidesteps the alpha problem entirely and
 * needs only 3 Imagick calls. Returns null (never throws) if Imagick
 * isn't available for any reason, so the caller can fall back to a
 * text-only wordmark instead of a missing or broken image — this is
 * genuinely optional, unlike the Ghostscript path, since there's no
 * correctness risk to a PDF with no logo, only a visual one.
 */
function pdf_load_png_as_jpeg_on_background(string $path, string $bgHex): ?array
{
    if (!class_exists('Imagick') || !is_file($path)) return null;
    try {
        $img = new Imagick($path);
        $bg = new Imagick();
        $bg->newImage($img->getImageWidth(), $img->getImageHeight(), new ImagickPixel($bgHex));
        $bg->setImageFormat('jpeg');
        $bg->compositeImage($img, Imagick::COMPOSITE_OVER, 0, 0);
        $bg->setImageCompressionQuality(88);
        $jpeg = $bg->getImageBlob();
        $width = $bg->getImageWidth();
        $height = $bg->getImageHeight();
        $img->clear();
        $bg->clear();
        return ['jpeg' => $jpeg, 'width' => $width, 'height' => $height];
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * The 2-page document policy_summary.php hands out (download or email):
 * page 1 is a branded "meet your advisor" profile page (website-matching
 * colors, no fabricated social links — only the office phone/address/
 * website this project actually has on file), page 2 is the per-policy
 * detail card, porting apps/crm/src/modules/clients/exportPolicySummaryPdf.ts's
 * layout into this file's pure-PHP drawing primitives so the same document
 * can be generated server-side for emailing, not just client-side for
 * on-demand download.
 *
 * @param array{full_name:string} $client
 * @param array{policy_number:?string,insurer:string,product_type:string,sum_assured:?float,premium:?float,start_date:?string,renewal_date:?string} $policy
 */
function pdf_write_policy_summary(array $client, array $policy, string $advisorName): string
{
    $pageWidth = 595;
    $marginX = 40;
    $officePhone = '+91 90331 32791';
    $officeAddress = '615, Krupal Pathshala, Shivaranjani Cross Road, Ahmedabad';
    $website = 'https://aa.tmarinternational.com/';
    $navy = PDF_BRAND['navy'];
    $gold = PDF_BRAND['gold'];
    $crimson = PDF_BRAND['crimson'];
    $text = PDF_BRAND['text'];
    $textSoft = PDF_BRAND['text_soft'];
    $surface2 = PDF_BRAND['surface2'];
    $line = PDF_BRAND['line'];
    $onNavy = PDF_BRAND['on_navy'];

    $esc = fn (string $s) => pdf_write_escape_text($s);
    $annotsP1 = [];
    $annotsP2 = [];
    $pageHeight = 842;

    // Real brand assets, not fabricated: the exact logo and hero photo the
    // public website uses (apps/website/assets/img/aangi-logo-full-tight.png,
    // hero-jainik-900.jpg — copied into this app's own assets/branding/ so
    // the path is identical in dev and production regardless of where the
    // website's own files happen to be deployed). The logo is a transparent
    // PNG — flattened onto the header's navy via Imagick (confirmed on this
    // project's Hostinger account) so it embeds as a plain JPEG; if Imagick
    // is ever unavailable, both just silently fall back to not drawing an
    // image rather than a broken one.
    $logo = pdf_load_png_as_jpeg_on_background(__DIR__ . '/../assets/branding/aangi-logo.png', '#0f2a4a');
    $photo = pdf_load_jpeg(__DIR__ . '/../assets/branding/jainik-photo.jpg');
    $images = [];
    if ($logo) $images['ImLogo'] = $logo;
    if ($photo) $images['ImPhoto'] = $photo;

    // ---------------- PAGE 1: profile — real website copy, logo, and photo ----------------
    $p1 = '';
    $p1 .= "$navy rg 0 " . ($pageHeight - 70) . " $pageWidth 70 re f\n";
    if ($logo) {
        $logoW = 150;
        $logoH = $logoW * $logo['height'] / $logo['width'];
        $logoY = $pageHeight - 70 + (70 - $logoH) / 2;
        $p1 .= "q $logoW 0 0 $logoH $marginX $logoY cm /ImLogo Do Q\n";
    } else {
        $p1 .= "1 g BT /F2 20 Tf $marginX " . ($pageHeight - 42) . " Td (" . $esc('AANGI ASSOCIATES') . ") Tj ET\n";
    }
    $p1 .= "$onNavy rg BT /F1 10.5 Tf " . ($pageWidth - $marginX - 270) . " " . ($pageHeight - 48) . " Td (" . $esc('Protecting What Matters. Securing What You Build.') . ") Tj ET\n";
    $p1 .= "$gold rg 0 " . ($pageHeight - 71.5) . " $pageWidth 1.5 re f\n";

    // Hero: photo on the left in a gold-framed box, headline + CTA on the right.
    $photoW = 160;
    $photoH = $photo ? $photoW * $photo['height'] / $photo['width'] : 200;
    $photoTop = $pageHeight - 90;
    $photoBottom = $photoTop - $photoH;
    if ($photo) {
        $p1 .= "$gold rg " . ($marginX - 4) . " " . ($photoBottom - 4) . " " . ($photoW + 8) . " " . ($photoH + 8) . " re f\n";
        $p1 .= "q $photoW 0 0 $photoH $marginX $photoBottom cm /ImPhoto Do Q\n";
    }

    $rx = $marginX + $photoW + 26;
    $rw = $pageWidth - $marginX - $rx;
    $ry = $photoTop - 6;
    $p1 .= "$navy rg BT /F2 18 Tf $rx $ry Td (" . $esc('Insurance & Financial') . ") Tj ET\n";
    $ry -= 21;
    $p1 .= "$navy rg BT /F2 18 Tf $rx $ry Td (" . $esc('Advisory Solutions') . ") Tj ET\n";
    $ry -= 20;
    $p1 .= "$gold rg BT /F2 11.5 Tf $rx $ry Td (" . $esc('Jainik Shah  -  17+ Years of Elite, Proven') . ") Tj ET\n";
    $ry -= 14;
    $p1 .= "$gold rg BT /F2 11.5 Tf $rx $ry Td (" . $esc('& Uncompromising Financial Advisory') . ") Tj ET\n";
    $ry -= 20;
    foreach (pdf_wrap_text('Trusted by 1,400+ families across Ahmedabad to secure their future and accelerate growth. Globally recognized (MDRT) advisory backed by steadfast, end-to-end claim assistance when it matters most.', $rw, 9.5) as $line_) {
        $p1 .= "$textSoft rg BT /F1 9.5 Tf $rx $ry Td (" . $esc($line_) . ") Tj ET\n";
        $ry -= 13;
    }
    $ry -= 6;
    $btnW = min($rw, 200);
    $p1 .= "$gold rg $rx " . ($ry - 20) . " $btnW 24 re f\n";
    $p1 .= "1 g BT /F2 10 Tf " . ($rx + 14) . " " . ($ry - 12) . " Td (" . $esc('Talk to an Advisor ->') . ") Tj ET\n";
    $annotsP1[] = ['rect' => [$rx, $ry - 20, $rx + $btnW, $ry + 4], 'uri' => 'https://wa.me/919033132791?text=' . rawurlencode("Hi Aangi Associates, I'd like to talk to an advisor.")];

    $y = $photoBottom - 34;

    // Pull-quote, verbatim from the website's About section.
    $p1 .= "$gold rg $marginX " . ($y - 40) . " 3 46 re f\n";
    foreach (pdf_wrap_text('"Insurance is not just about issuing a policy. It is about protecting income, assets, business, and family security."', $pageWidth - $marginX * 2 - 16, 11) as $i => $line_) {
        $p1 .= "$navy rg BT /F2 11 Tf " . ($marginX + 14) . " " . ($y - $i * 14) . " Td (" . $esc($line_) . ") Tj ET\n";
    }
    $y -= 56;

    // Bio — the two real paragraphs from the website's About section.
    $p1 .= "$navy rg BT /F2 10.5 Tf $marginX $y Td (" . $esc('Chief Business Associate Leader - TATA AIA Life Insurance') . ") Tj ET\n";
    $y -= 18;
    $bioParas = [
        "Over 17 years, Jainik Shah has built Aangi Associates around one idea: insurance only matters if the claim actually gets paid, on time, without a fight. That focus on hassle-free claim assistance has earned the practice MDRT recognition and the trust of 1,400+ client families across Ahmedabad.",
        "His approach: understanding real financial risks, designing customized protection strategies, ensuring smooth and reliable claim assistance, and providing consistent long-term service support. It's why clients who join as individuals often stay as families, across life stages and generations.",
    ];
    foreach ($bioParas as $para) {
        foreach (pdf_wrap_text($para, $pageWidth - $marginX * 2, 9.5) as $line_) {
            $p1 .= "$textSoft rg BT /F1 9.5 Tf $marginX $y Td (" . $esc($line_) . ") Tj ET\n";
            $y -= 13;
        }
        $y -= 6;
    }

    // Trust stats — verbatim from the website's trust strip.
    $y -= 10;
    $stats = [
        '17+ Years in the Industry',
        '1,400+ Satisfied Client Families',
        'MDRT-Qualified Practice - 2021, 2022, 2024 & 2025',
        'Official TATA AIA CBA Partner',
    ];
    $statW = ($pageWidth - $marginX * 2 - 3 * 8) / 4;
    $statH = 46;
    foreach ($stats as $i => $stat) {
        $sx = $marginX + $i * ($statW + 8);
        $p1 .= "$surface2 rg $sx " . ($y - $statH) . " $statW $statH re f\n";
        $p1 .= "$gold rg $sx " . ($y - 3) . " $statW 3 re f\n";
        foreach (pdf_wrap_text($stat, $statW - 12, 8) as $li => $line_) {
            $p1 .= "$navy rg BT /F2 8 Tf " . ($sx + 6) . " " . ($y - 16 - $li * 10) . " Td (" . $esc($line_) . ") Tj ET\n";
        }
    }
    $y -= $statH + 24;

    // Reach Us strip
    $p1 .= "$surface2 rg $marginX " . ($y - 56) . " " . ($pageWidth - $marginX * 2) . " 56 re f\n";
    $cardTop = $y - 14;
    $p1 .= "$navy rg BT /F2 11 Tf " . ($marginX + 10) . " $cardTop Td (" . $esc('Reach Us Anytime') . ") Tj ET\n";
    $rowY = $cardTop - 18;
    $p1 .= "$text rg BT /F1 10 Tf " . ($marginX + 10) . " $rowY Td (" . $esc("Phone / WhatsApp: $officePhone") . ") Tj ET\n";
    $annotsP1[] = ['rect' => [$marginX + 10, $rowY - 2, $marginX + 220, $rowY + 10], 'uri' => 'https://wa.me/' . preg_replace('/\D/', '', $officePhone)];
    $p1 .= "$text rg BT /F1 10 Tf " . ($marginX + 260) . " $rowY Td (" . $esc('Website: aa.tmarinternational.com') . ") Tj ET\n";
    $annotsP1[] = ['rect' => [$marginX + 260, $rowY - 2, $marginX + 470, $rowY + 10], 'uri' => $website];
    $rowY -= 16;
    $p1 .= "$textSoft rg BT /F1 9 Tf " . ($marginX + 10) . " $rowY Td (" . $esc($officeAddress . '  -  GSTIN: 24ACBFA747OP1Z2') . ") Tj ET\n";

    $p1 .= "$navy rg 0 0 $pageWidth 22 re f\n";
    $p1 .= "$onNavy rg BT /F1 8 Tf $marginX 8 Td (" . $esc('This profile page accompanies every policy summary Aangi Associates sends or hands out.') . ") Tj ET\n";

    // ---------------- PAGE 2: policy detail (ported from exportPolicySummaryPdf.ts) ----------------
    $p2 = '';
    $p2 .= "$navy rg 0 816 $pageWidth 26 re f\n";
    $p2 .= "1 g BT /F2 10 Tf " . ($pageWidth - $marginX - 170) . " 830 Td (" . $esc($officePhone) . ") Tj ET\n";
    $p2 .= "$gold rg 0 814.5 $pageWidth 1.3 re f\n";

    $p2 .= "$text rg BT /F2 20 Tf $marginX 790 Td (" . $esc('POLICY SUMMARY') . ") Tj ET\n";
    $p2 .= "$gold RG 2 w $marginX 785 m " . ($marginX + 26) . " 785 l S 0 w\n";

    // NOTE on the numbers below: this was originally ported from
    // exportPolicySummaryPdf.ts, which draws in jsPDF's default unit
    // (millimeters). This file has no unit system of its own — every
    // coordinate is in PDF points (1/72 inch, ~2.83x a millimeter) — so
    // the ported mm-sized gaps (5.5, 14, 32...) were roughly a third of
    // what they needed to be and every line overlapped the next.
    // Confirmed visually before shipping (same lesson as pdf_write.php's
    // very first version, which caught the em-dash/₹ glyph issues the
    // same way) and rebuilt with real point-sized line heights instead
    // of a mechanical mm->pt conversion of the original numbers.
    $y = 760;
    $cardTop = $y;
    $noteHeight = 54;
    $p2 .= "$surface2 rg $marginX " . ($cardTop - $noteHeight) . " " . ($pageWidth - $marginX * 2) . " $noteHeight re f\n";
    $p2 .= "$text rg BT /F2 12 Tf " . ($marginX + 10) . " " . ($cardTop - 16) . " Td (" . $esc('Dear ' . $client['full_name'] . ',') . ") Tj ET\n";
    $p2 .= "$gold rg BT /F2 10.5 Tf " . ($marginX + 10) . " " . ($cardTop - 31) . " Td (" . $esc("Thank you for trusting us with something this important.") . ") Tj ET\n";
    foreach (pdf_wrap_text("Your policy is more than paperwork - it's our commitment to stand by you and your family when it matters most.", $pageWidth - $marginX * 2 - 20, 9) as $i => $line_) {
        $p2 .= "$textSoft rg BT /F1 9 Tf " . ($marginX + 10) . " " . ($cardTop - 44 - $i * 11) . " Td (" . $esc($line_) . ") Tj ET\n";
    }

    $y = $cardTop - $noteHeight - 18;
    $p2 .= "$navy rg $marginX " . ($y - 16) . " " . ($pageWidth - $marginX * 2) . " 16 re f\n";
    $p2 .= "1 g BT /F2 10 Tf " . ($marginX + 10) . " " . ($y - 11) . " Td (" . $esc("Advisor: $advisorName") . ") Tj ET\n";

    $y -= 16 + 16;
    $cardHeight = 112;
    $cardTop = $y;
    $p2 .= "$line RG 0.5 w $marginX " . ($cardTop - $cardHeight) . " " . ($pageWidth - $marginX * 2) . " $cardHeight re S\n";
    $p2 .= "$navy rg $marginX " . ($cardTop - 16) . " " . ($pageWidth - $marginX * 2) . " 16 re f\n";
    $p2 .= "1 g BT /F2 10.5 Tf " . ($marginX + 10) . " " . ($cardTop - 11) . " Td (" . $esc('Policy Detail') . ") Tj ET\n";

    $colL = $marginX + 10;
    $colR = $marginX + (int) (($pageWidth - $marginX * 2) / 2) + 10;
    $rowY = $cardTop - 34;
    $row2 = function (string $x, float $y, string $label, string $value) use (&$p2, $esc, $textSoft, $text) {
        $p2 .= "$textSoft rg BT /F1 8.5 Tf $x $y Td (" . $esc($label) . ") Tj ET\n";
        $p2 .= "$text rg BT /F2 11 Tf $x " . ($y - 14) . " Td (" . $esc($value) . ") Tj ET\n";
    };
    $row2((string) $colL, $rowY, 'Policyholder', $client['full_name']);
    $row2((string) $colR, $rowY, 'Policy Start Date', pdf_format_date($policy['start_date']));
    $rowY -= 28;
    $row2((string) $colL, $rowY, 'Policy Number', $policy['policy_number'] ?? '-');
    $row2((string) $colR, $rowY, 'Renewal / End Date', pdf_format_date($policy['renewal_date']));
    $rowY -= 28;
    $row2((string) $colL, $rowY, 'Policy Type', $policy['product_type']);
    $row2((string) $colR, $rowY, 'Insurance Company', $policy['insurer']);

    $y = $cardTop - $cardHeight - 16;
    $halfW = ($pageWidth - $marginX * 2 - 10) / 2;
    $stripHeight = 38;
    $p2 .= "$surface2 rg $marginX " . ($y - $stripHeight) . " $halfW $stripHeight re f\n";
    $p2 .= "$surface2 rg " . ($marginX + $halfW + 10) . " " . ($y - $stripHeight) . " $halfW $stripHeight re f\n";
    $p2 .= "$textSoft rg BT /F1 9 Tf " . ($marginX + 10) . " " . ($y - 14) . " Td (" . $esc('Sum Assured') . ") Tj ET\n";
    $p2 .= "$textSoft rg BT /F1 9 Tf " . ($marginX + $halfW + 20) . " " . ($y - 14) . " Td (" . $esc('Premium') . ") Tj ET\n";
    $p2 .= "$crimson rg BT /F2 14 Tf " . ($marginX + 10) . " " . ($y - 30) . " Td (" . $esc(pdf_format_inr($policy['sum_assured'])) . ") Tj ET\n";
    $p2 .= "$crimson rg BT /F2 14 Tf " . ($marginX + $halfW + 20) . " " . ($y - 30) . " Td (" . $esc(pdf_format_inr($policy['premium'])) . ") Tj ET\n";

    $y -= $stripHeight + 20;
    foreach (pdf_wrap_text("This is a quick-reference summary, not a substitute for your official policy document, premium receipt, or policy wording - please refer to those for the complete terms, conditions, and exclusions.", $pageWidth - $marginX * 2, 8) as $i => $line_) {
        $p2 .= "$textSoft rg BT /F1 8 Tf $marginX " . ($y - $i * 11) . " Td (" . $esc($line_) . ") Tj ET\n";
    }
    $y -= 22; // account for the 2-line disclaimer above before the next block

    $y -= 26;
    $p2 .= "$gold rg BT /F2 12 Tf $marginX $y Td (" . $esc('Explore More Protection for Your Family') . ") Tj ET\n";
    $y -= 18;
    foreach (pdf_wrap_text("A policy review takes 15 minutes and could reveal gaps in health, savings, or retirement cover you haven't thought about yet. Reply on WhatsApp below whenever you'd like to talk it through - no obligation.", $pageWidth - $marginX * 2, 9) as $i => $line_) {
        $p2 .= "$textSoft rg BT /F1 9 Tf $marginX " . ($y - $i * 12) . " Td (" . $esc($line_) . ") Tj ET\n";
    }

    // Calculators showcase — every calculator actually on the website
    // (apps/website/calculators.html), not a curated subset. Each one links
    // to the same calculators page rather than a fabricated per-calculator
    // deep link: the live page has no URL-hash tab routing to link to (confirmed
    // by reading its JS), so a working single destination is more honest than
    // 16 identical-looking buttons that quietly all go to the same place —
    // one clear "Open All Calculators" button does that job better anyway.
    $y -= 40;
    $p2 .= "$navy rg $marginX " . ($y - 16) . " " . ($pageWidth - $marginX * 2) . " 16 re f\n";
    $p2 .= "1 g BT /F2 11 Tf " . ($marginX + 10) . " " . ($y - 11) . " Td (" . $esc('Free Financial Calculators') . ") Tj ET\n";
    $y -= 26;
    foreach (pdf_wrap_text('Illustrative planning tools, free to use on our website - estimate what you need, not what to buy.', $pageWidth - $marginX * 2, 9) as $line_) {
        $p2 .= "$textSoft rg BT /F1 9 Tf $marginX $y Td (" . $esc($line_) . ") Tj ET\n";
        $y -= 12;
    }
    $y -= 8;

    $calculators = [
        'Human Life Value / Term Insurance Need', 'Child Education Planner',
        'Dream Wedding Planner', 'Dream Car / Bike / Property Planner',
        'Dream Vacation Planner', 'SIP Calculator',
        'Lumpsum Calculator', 'Cost of Delay Calculator',
        'Retirement Corpus Estimator', 'SIP Top-Up Calculator',
        'Limited Period SIP Calculator', 'Birthday SIP Calculator',
        'EMI Calculator', 'Home Loan vs SIP Calculator',
        'SWP Calculator', 'Protection Gap Score',
    ];
    $calcColW = ($pageWidth - $marginX * 2 - 10) / 2;
    $calcRowH = 22;
    foreach ($calculators as $i => $calcName) {
        $col = $i % 2;
        $row = (int) ($i / 2);
        $cx = $marginX + $col * ($calcColW + 10);
        $cyTop = $y - $row * $calcRowH;
        $p2 .= "$surface2 rg $cx " . ($cyTop - 17) . " $calcColW 17 re f\n";
        $p2 .= "$gold rg $cx " . ($cyTop - 17) . " 3 17 re f\n";
        foreach (pdf_wrap_text($calcName, $calcColW - 16, 8.5) as $li => $line_) {
            if ($li > 1) break; // 2 lines max per card keeps the grid even
            $p2 .= "$navy rg BT /F2 8.5 Tf " . ($cx + 10) . " " . ($cyTop - 12 - $li * 10) . " Td (" . $esc($line_) . ") Tj ET\n";
        }
    }
    $gridRows = (int) ceil(count($calculators) / 2);
    $y -= $gridRows * $calcRowH + 16;

    $calcBtnW = 220;
    $p2 .= "$gold rg $marginX " . ($y - 24) . " $calcBtnW 24 re f\n";
    $p2 .= "1 g BT /F2 10 Tf " . ($marginX + 14) . " " . ($y - 16) . " Td (" . $esc('Open All Calculators ->') . ") Tj ET\n";
    $annotsP2[] = ['rect' => [$marginX, $y - 24, $marginX + $calcBtnW, $y], 'uri' => 'https://aa.tmarinternational.com/calculators.html'];

    $footerY2 = 22;
    $p2 .= "$navy rg 0 0 $pageWidth $footerY2 re f\n";
    $p2 .= "1 g BT /F2 9 Tf $marginX 14 Td (" . $esc('Reach Us Anytime') . ") Tj ET\n";
    $contactLine = "$advisorName  .  $officePhone (tap to WhatsApp)";
    $p2 .= "1 g BT /F1 8 Tf $marginX 8.5 Td (" . $esc($contactLine) . ") Tj ET\n";
    $waMessage = rawurlencode("Hi, I'm {$client['full_name']} - I'd like to talk about reviewing my family's protection plan.");
    $annotsP2[] = ['rect' => [$marginX, 7, $marginX + 260, 17], 'uri' => 'https://wa.me/' . preg_replace('/\D/', '', $officePhone) . '?text=' . $waMessage];

    return pdf_assemble_document(
        [
            ['content' => $p1, 'annots' => $annotsP1],
            ['content' => $p2, 'annots' => $annotsP2],
        ],
        $images,
    );
}
