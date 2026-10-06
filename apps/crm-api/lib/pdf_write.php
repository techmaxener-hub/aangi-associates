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
 * @param ?string $openPassword When set, the document is encrypted (PDF Standard Security Handler, RC4-128/R3 — see lib/pdf_crypto.php) and this is the password required to open it at all. Null (the default) produces a plain, unencrypted PDF exactly as before.
 */
function pdf_assemble_document(array $pages, array $images = [], int $pageWidth = 595, int $pageHeight = 842, ?string $openPassword = null): string
{
    $objects = [];
    $pageRefs = [];
    $nextId = 5; // 1 Catalog, 2 Pages, 3 Font(Helvetica), 4 Font(Helvetica-Bold)

    // Every stream and every string this function writes AFTER encryption
    // is prepared below must go through $enc()/$encStr() so it ends up
    // RC4-encrypted with that specific object's own per-object key — per
    // spec, each object number folds into its key, so this can only be
    // applied once object numbers are assigned, i.e. inline below rather
    // than as a single pass at the end.
    $crypto = null;
    if ($openPassword !== null) {
        require_once __DIR__ . '/pdf_crypto.php';
        $crypto = pdf_crypto_prepare($openPassword);
    }
    $enc = function (string $bytes, int $objId) use ($crypto): string {
        return $crypto ? pdf_rc4(($crypto['object_key'])($objId, 0), $bytes) : $bytes;
    };

    $imageIds = [];
    foreach ($images as $name => $img) {
        $id = $nextId++;
        $imageIds[$name] = $id;
        $jpeg = $enc($img['jpeg'], $id);
        $objects[$id] = "$id 0 obj\n<< /Type /XObject /Subtype /Image /Width {$img['width']} /Height {$img['height']} "
            . "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " . strlen($jpeg) . " >>\nstream\n"
            . $jpeg . "\nendstream\nendobj\n";
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
            // Encrypted documents hex-encode the URI string (the encrypted
            // bytes are arbitrary binary — a hex string `<...>` needs no
            // literal-string escaping at all, unlike `(...)`). Unencrypted
            // documents keep the exact plain literal-string form this file
            // has always used, byte-for-byte unchanged.
            $uriStr = $crypto
                ? pdf_crypto_hex_string($enc($a['uri'], $annotId))
                : '(' . str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $a['uri']) . ')';
            $objects[$annotId] = "$annotId 0 obj\n<< /Type /Annot /Subtype /Link /Rect [$x1 $y1 $x2 $y2] /Border [0 0 0] /A << /Type /Action /S /URI /URI $uriStr >> >>\nendobj\n";
            $annotRefs[] = "$annotId 0 R";
        }
        $annotsArray = $annotRefs ? '[' . implode(' ', $annotRefs) . ']' : '[]';
        $content = $enc($page['content'], $contentId);
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

    $encryptId = null;
    $idHex = null;
    if ($crypto) {
        $encryptId = $nextId++;
        $totalObjects = $nextId - 1;
        $idHex = strtoupper(bin2hex($crypto['id']));
        $objects[$encryptId] = "$encryptId 0 obj\n<< /Filter /Standard /V 2 /R 3 /Length 128 "
            . '/O ' . pdf_crypto_hex_string($crypto['o']) . ' '
            . '/U ' . pdf_crypto_hex_string($crypto['u']) . ' '
            . '/P ' . $crypto['p']
            . " >>\nendobj\n";
    }

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
    $trailer = "<< /Size " . ($totalObjects + 1) . " /Root 1 0 R";
    if ($crypto) $trailer .= " /Encrypt $encryptId 0 R /ID [<$idHex> <$idHex>]";
    $trailer .= " >>";
    $out .= "trailer\n$trailer\nstartxref\n$xrefOffset\n%%EOF";
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
    // Exact match of apps/website/assets/css/main.css's .contact-social-icon
    // badge background (#003399) — the real circle color every social icon
    // sits in on the live site's Contact page, reused here so the PDF's
    // badges are the same brand mark, not an invented color.
    'social_badge' => '0 0.200 0.600',
];

// The real, verified contact/social links from apps/website/contact.html —
// never fabricated. Instagram + LinkedIn also appear in index.html's
// schema.org "sameAs" JSON-LD. WhatsApp and Email reuse the same office
// number/address already used elsewhere in this file.
const PDF_SOCIAL_LINKS = [
    'instagram' => 'https://www.instagram.com/jainik1771',
    'linkedin' => 'https://www.linkedin.com/in/jainik-shah-b1991019a',
    'whatsapp' => 'https://wa.me/919033132791',
    'email' => 'mailto:jainik1771@gmail.com',
];

/**
 * Formats a float for a PDF content stream. Deliberately NOT sprintf's
 * %f/%F — those are locale-aware (LC_NUMERIC), and on a server locale that
 * uses "," as the decimal separator, sprintf('%.2F', 12.5) silently
 * produces "12,50", which is not a valid PDF number and corrupts the rest
 * of that content stream from that point on (confirmed live: it rendered
 * fine locally under this machine's "C" locale, then on first use on
 * production everything from the first circle/rounded-rect path onward
 * went missing, while plain `(string) $float` interpolation elsewhere in
 * this file — which PHP always renders with "." regardless of locale —
 * kept working). number_format()'s separator arguments are explicit, not
 * locale-dependent, so this is safe everywhere.
 */
function pdf_num(float $n): string
{
    return number_format($n, 2, '.', '');
}

/**
 * A circle as a PDF path (Bezier-approximated, the standard k=0.5523*r
 * control-point offset) — left unpainted so the caller appends f/S/f*.
 * Used for the social-icon badges and for rounded-rect corners below.
 */
function pdf_circle_path(float $cx, float $cy, float $r): string
{
    $k = 0.5522847498 * $r;
    $n = fn (float $v) => pdf_num($v);
    return $n($cx) . ' ' . $n($cy + $r) . ' m '
        . $n($cx + $k) . ' ' . $n($cy + $r) . ' ' . $n($cx + $r) . ' ' . $n($cy + $k) . ' ' . $n($cx + $r) . ' ' . $n($cy) . ' c '
        . $n($cx + $r) . ' ' . $n($cy - $k) . ' ' . $n($cx + $k) . ' ' . $n($cy - $r) . ' ' . $n($cx) . ' ' . $n($cy - $r) . ' c '
        . $n($cx - $k) . ' ' . $n($cy - $r) . ' ' . $n($cx - $r) . ' ' . $n($cy - $k) . ' ' . $n($cx - $r) . ' ' . $n($cy) . ' c '
        . $n($cx - $r) . ' ' . $n($cy + $k) . ' ' . $n($cx - $k) . ' ' . $n($cy + $r) . ' ' . $n($cx) . ' ' . $n($cy + $r) . ' c '
        . "h ";
}

/**
 * A rounded rectangle as a PDF path, same unpainted convention as
 * pdf_circle_path(). $y is the BOTTOM edge (this file's existing
 * convention for plain `re` rects), $w/$h the full size, $r the corner
 * radius. Used everywhere a card/badge needs softer corners than the
 * straight `re` operator gives.
 */
function pdf_rounded_rect_path(float $x, float $y, float $w, float $h, float $r): string
{
    $k = 0.5522847498 * $r;
    $yTop = $y + $h;
    $x2 = $x + $w;
    $n = fn (float $v) => pdf_num($v);
    return $n($x) . ' ' . $n($y + $r) . ' m '
        . $n($x) . ' ' . $n($yTop - $r) . ' l '
        . $n($x) . ' ' . $n($yTop - $r + $k) . ' ' . $n($x + $r - $k) . ' ' . $n($yTop) . ' ' . $n($x + $r) . ' ' . $n($yTop) . ' c '
        . $n($x2 - $r) . ' ' . $n($yTop) . ' l '
        . $n($x2 - $r + $k) . ' ' . $n($yTop) . ' ' . $n($x2) . ' ' . $n($yTop - $r + $k) . ' ' . $n($x2) . ' ' . $n($yTop - $r) . ' c '
        . $n($x2) . ' ' . $n($y + $r) . ' l '
        . $n($x2) . ' ' . $n($y + $r - $k) . ' ' . $n($x2 - $r + $k) . ' ' . $n($y) . ' ' . $n($x2 - $r) . ' ' . $n($y) . ' c '
        . $n($x + $r) . ' ' . $n($y) . ' l '
        . $n($x + $r - $k) . ' ' . $n($y) . ' ' . $n($x) . ' ' . $n($y + $r - $k) . ' ' . $n($x) . ' ' . $n($y + $r) . ' c '
        . "h ";
}

/**
 * Real, recognizable social icon glyphs drawn as PDF vector paths — not a
 * generic placeholder shape. Instagram and Email are near-exact
 * reproductions (same rounded-square+lens+dot / envelope+chevron geometry)
 * of the actual SVGs in apps/website/contact.html's .contact-social-icon
 * buttons; LinkedIn and WhatsApp use that same brand's real lettermark/
 * silhouette simplified to what this hand-rolled PDF path engine can draw
 * (no SVG arc support), rather than attempting a byte-for-byte Bezier port
 * of their curvier official glyphs. All four are drawn in white centered
 * on a badge of radius $r at ($cx, $cy); the badge fill itself is drawn by
 * the caller (pdf_social_badge()) so icon and background stay one call.
 */
function pdf_icon_instagram(float $cx, float $cy, float $r): string
{
    $s = $r * 0.72; // icon half-extent inside the badge
    $out = '1 G 1.4 w ' . pdf_rounded_rect_path($cx - $s, $cy - $s, $s * 2, $s * 2, $s * 0.42) . "S\n";
    $out .= '1 G 1.4 w ' . pdf_circle_path($cx, $cy, $s * 0.46) . "S\n";
    $out .= '1 g ' . pdf_circle_path($cx + $s * 0.62, $cy + $s * 0.62, $s * 0.12) . "f\n";
    return $out;
}

function pdf_icon_linkedin(float $cx, float $cy, float $r): string
{
    $fontSize = $r * 1.25;
    $tx = $cx - $fontSize * 0.46;
    $ty = $cy - $fontSize * 0.33;
    return "1 g BT /F2 $fontSize Tf $tx $ty Td (in) Tj ET\n";
}

function pdf_icon_whatsapp(float $cx, float $cy, float $r): string
{
    $s = $r * 0.72;
    $w = $s * 1.9;
    $h = $s * 1.6;
    $x = $cx - $w / 2;
    $y = $cy - $h / 2 + $s * 0.18;
    $out = '1 g ' . pdf_rounded_rect_path($x, $y, $w, $h, $s * 0.5) . "f\n";
    $tailX = $x + $w * 0.3;
    $out .= "1 g $tailX $y m " . ($tailX - $s * 0.26) . ' ' . ($y - $s * 0.38) . " l " . ($tailX + $s * 0.32) . " $y l h f\n";
    return $out;
}

function pdf_icon_email(float $cx, float $cy, float $r): string
{
    $s = $r * 0.72;
    $w = $s * 2;
    $h = $s * 1.4;
    $x = $cx - $w / 2;
    $y = $cy - $h / 2;
    $out = '1 G 1.4 w ' . pdf_rounded_rect_path($x, $y, $w, $h, $s * 0.22) . "S\n";
    $midY = $y + $h * 0.6;
    $out .= "1 G 1.4 w $x " . ($y + $h) . " m $cx $midY l " . ($x + $w) . ' ' . ($y + $h) . " l S\n";
    return $out;
}

/** Draws one navy-blue circle badge (the exact color of the website's real .contact-social-icon buttons) with the given icon glyph inside, centered at ($cx, $cy) with radius $r. */
function pdf_social_badge(float $cx, float $cy, float $r, string $iconKind): string
{
    $out = PDF_BRAND['social_badge'] . ' rg ' . pdf_circle_path($cx, $cy, $r) . "f\n";
    $out .= match ($iconKind) {
        'instagram' => pdf_icon_instagram($cx, $cy, $r),
        'linkedin' => pdf_icon_linkedin($cx, $cy, $r),
        'whatsapp' => pdf_icon_whatsapp($cx, $cy, $r),
        'email' => pdf_icon_email($cx, $cy, $r),
        default => '',
    };
    return $out;
}

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
 * A large, very light-gray rotated wordmark behind a page's real content
 * — drawn FIRST (so everything else paints over it), using the text
 * matrix's rotation terms directly (`cos sin -sin cos x y Tm`) since this
 * engine has no image alpha-blending (see pdf_load_png_as_jpeg_on_background's
 * docblock for why) and a flattened-JPEG watermark image would either
 * cover real content or need real transparency support neither this file
 * nor a plain /DCTDecode image stream has. Pale gray text sidesteps that
 * entirely — same visual effect, zero new PDF machinery.
 */
function pdf_watermark(float $pageWidth, float $pageHeight, string $text = 'AANGI ASSOCIATES'): string
{
    $angleDeg = 28;
    $rad = deg2rad($angleDeg);
    $cos = pdf_num(cos($rad));
    $sin = pdf_num(sin($rad));
    $cx = $pageWidth / 2;
    $cy = $pageHeight / 2;
    return "0.94 0.94 0.94 rg BT /F2 46 Tf $cos $sin -$sin $cos " . pdf_num($cx - 230) . ' ' . pdf_num($cy - 20) . " Tm (" . pdf_write_escape_text($text) . ") Tj ET\n";
}

// The real 4-step claims process, verbatim from apps/website/claims.html's
// #four-step-system stepper — never re-drafted or summarized.
const PDF_CLAIMS_STEPS = [
    ['label' => '01 . Day 0', 'title' => 'Immediate Notification', 'body' => 'One WhatsApp message or call to the dedicated claim desk starts the process the same day.'],
    ['label' => '02 . Day 1-3', 'title' => 'Documentation Support', 'body' => 'Our team prepares and verifies the paperwork with you, so nothing is rejected on a technicality.'],
    ['label' => '03 . Day 4-15', 'title' => 'Insurer Liaison', 'body' => 'We follow up directly with TATA AIA / the respective insurer on your behalf.'],
    ['label' => '04 . Day 15-30', 'title' => 'Settlement Confirmation', 'body' => 'We confirm the payout with the family and stay available for anything that follows.'],
];

/**
 * Maps a product_type (apps/crm/src/modules/clients/types.ts's
 * PRODUCT_TYPES) to its matching real document checklist from
 * apps/website/assets/js/claim-checklist.js's CHECKLISTS object — every
 * title/item below is quoted verbatim from that file, never invented.
 * This is intentionally its OWN mapping, not a reuse of that same file's
 * PRODUCT_TYPE_TO_POLICY_TAB: a "Guaranteed Return Plan" claim is a
 * MATURITY claim even though its policy-list tab is "Life Insurance" —
 * the claims checklist cares what kind of claim gets filed, the list
 * tab cares what kind of product it is, and those aren't the same axis.
 * Returns null for non-insurance products (loans, credit cards) — there
 * is no claim checklist for those, and none should be invented.
 */
function pdf_claim_checklist(string $productType): ?array
{
    $checklists = [
        'death' => [
            'title' => 'Term / Life Insurance - Death Claim Checklist',
            'items' => [
                'Original policy document', 'Duly filled claim intimation form',
                'Original death certificate (issued by municipal authority)',
                "Nominee's ID proof (Aadhaar / PAN / Passport)", "Nominee's bank details + a cancelled cheque",
                'Hospital treatment records / discharge summary, if applicable',
                'FIR and post-mortem report, for an accidental or unnatural death',
                'Legal heir certificate, if a nominee was not registered on the policy',
            ],
        ],
        'health' => [
            'title' => 'Critical Illness, Mediclaim & Group Health - Claim Checklist',
            'items' => [
                'Duly filled claim form (Part A by the insured, Part B by the hospital for cashless)',
                'Original hospital bills and payment receipts', 'Discharge summary',
                'Investigation reports (lab tests, imaging)', "Doctor's prescriptions and consultation notes",
                'Pharmacy bills', 'Policy copy and ID proof', 'Bank details + a cancelled cheque',
            ],
        ],
        'maturity' => [
            'title' => 'Education, Guaranteed Return, Pension & Mutual Fund - Maturity Checklist',
            'items' => [
                'Original policy document', 'Maturity discharge form', 'ID proof',
                'PAN card (for TDS purposes)', 'Bank details + a cancelled cheque',
                'Age proof, if not already submitted with the original application',
            ],
        ],
        'general' => [
            'title' => 'General Insurance (Motor / Property) - Claim Checklist',
            'items' => [
                'Claim intimation to the insurer', 'FIR, for theft or a major accident',
                'Repair estimate and final invoice', 'Photographs of the damage',
                'Registration Certificate (RC) and driving license, for a motor claim',
                'Policy copy', 'Bank details + a cancelled cheque',
            ],
        ],
    ];
    $byProductType = [
        'Pure Term Plan' => 'death',
        'Keyman Insurance' => 'death',
        'Family Mediclaim' => 'health',
        'Critical Illness Cover' => 'health',
        'Group Health Cover' => 'health',
        'Child Education Plan' => 'maturity',
        'Guaranteed Return Plan' => 'maturity',
        'Pension/Annuity' => 'maturity',
        'Mutual Fund' => 'maturity',
        'General Insurance' => 'general',
    ];
    $key = $byProductType[$productType] ?? null;
    return $key ? $checklists[$key] : null;
}

/**
 * Same Imagick-based path pdf_load_png_as_jpeg_on_background() uses, but
 * for an already-JPEG source that just needs to be SMALLER — the real
 * MDRT certificate scans are full-resolution website assets (~100KB+
 * each), too big to embed 4-up at full size. Falls back to the plain,
 * uncompressed original via pdf_load_jpeg() if Imagick is unavailable —
 * bigger file, same correct image, never a missing one.
 */
function pdf_load_jpeg_resized(string $path, int $maxWidth): ?array
{
    if (class_exists('Imagick')) {
        try {
            $img = new Imagick($path);
            if ($img->getImageWidth() > $maxWidth) {
                $img->resizeImage($maxWidth, 0, Imagick::FILTER_LANCZOS, 1);
            }
            $img->setImageCompressionQuality(80);
            $img->setImageFormat('jpeg');
            $jpeg = $img->getImageBlob();
            $w = $img->getImageWidth();
            $h = $img->getImageHeight();
            $img->clear();
            return ['jpeg' => $jpeg, 'width' => $w, 'height' => $h];
        } catch (Throwable $e) {
            // fall through to the uncompressed original below
        }
    }
    return pdf_load_jpeg($path);
}

/** A thin horizontal progress bar from policy start to renewal, with "today" marked — purely computed from the policy's own real dates, nothing estimated or fabricated. Returns '' (draws nothing) if either date is missing, rather than guessing. */
function pdf_timeline_bar(float $x, float $yTop, float $width, ?string $startIso, ?string $renewalIso): string
{
    if (!$startIso || !$renewalIso) return '';
    $start = strtotime($startIso);
    $end = strtotime($renewalIso);
    $now = time();
    if (!$start || !$end || $end <= $start) return '';
    $frac = max(0, min(1, ($now - $start) / ($end - $start)));

    $navy = PDF_BRAND['navy'];
    $gold = PDF_BRAND['gold'];
    $line = PDF_BRAND['line'];
    $textSoft = PDF_BRAND['text_soft'];
    $barH = 6;
    $barY = $yTop - $barH;
    $out = "$line rg " . pdf_rounded_rect_path($x, $barY, $width, $barH, 3) . "f\n";
    $filledW = max($barH, $width * $frac); // never thinner than the bar is tall, so the rounded cap always reads as filled
    $out .= "$gold rg " . pdf_rounded_rect_path($x, $barY, $filledW, $barH, 3) . "f\n";
    $markerX = $x + $width * $frac;
    $out .= "$navy rg " . pdf_circle_path($markerX, $barY + $barH / 2, 5) . "f\n";
    $out .= "$textSoft rg BT /F1 7.5 Tf " . $x . ' ' . ($barY - 11) . " Td (" . pdf_write_escape_text(pdf_format_date($startIso)) . ") Tj ET\n";
    $endLabelW = strlen(pdf_format_date($renewalIso)) * 7.5 * 0.52;
    $out .= "$textSoft rg BT /F1 7.5 Tf " . ($x + $width - $endLabelW) . ' ' . ($barY - 11) . " Td (" . pdf_write_escape_text(pdf_format_date($renewalIso)) . ") Tj ET\n";
    return $out;
}

/** "N days to renewal" / "Renewal due today" / "N days overdue — policy may have lapsed" / "Renewed Xd ago", purely computed from the real renewal_date, never estimated. Null renewal_date returns null (caller skips the badge entirely). */
function pdf_renewal_countdown_label(?string $renewalIso): ?array
{
    if (!$renewalIso) return null;
    $end = strtotime($renewalIso);
    if (!$end) return null;
    $days = (int) floor((strtotime(date('Y-m-d', $end)) - strtotime(date('Y-m-d'))) / 86400);
    if ($days > 1) return ['text' => "$days days to renewal", 'tone' => $days <= 30 ? 'warn' : 'ok'];
    if ($days === 1) return ['text' => '1 day to renewal', 'tone' => 'warn'];
    if ($days === 0) return ['text' => 'Renewal due today', 'tone' => 'warn'];
    return ['text' => (-$days) . ' day(s) overdue - please renew promptly', 'tone' => 'alert'];
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
 * Draws a QR code (see lib/qr.php) as plain filled-square vector paths —
 * no image, no library, just `re f` rectangles for each dark module. $size
 * is the full side length in points; the matrix is scaled + a 2-module
 * quiet-zone border is added automatically (quiet zone is required for
 * real-world scanning — a code with no white margin often fails to
 * decode even though the data is correct). Draws nothing (returns '') if
 * qr_generate_matrix() can't encode $data, rather than a broken code.
 */
function pdf_draw_qr(float $x, float $y, float $size, string $data): string
{
    require_once __DIR__ . '/qr.php';
    $matrix = qr_generate_matrix($data);
    if ($matrix === null) return '';
    $modules = count($matrix);
    $quiet = 2;
    $cell = $size / ($modules + $quiet * 2);
    $out = '1 g ' . pdf_num($x) . ' ' . pdf_num($y) . ' ' . pdf_num($size) . ' ' . pdf_num($size) . " re f\n";
    $out .= "0 g\n";
    for ($row = 0; $row < $modules; $row++) {
        for ($col = 0; $col < $modules; $col++) {
            if (!$matrix[$row][$col]) continue;
            // Matrix row 0 is the TOP row; PDF y grows upward, so row
            // index flips relative to $y (the box's bottom edge).
            $cx = $x + ($quiet + $col) * $cell;
            $cy = $y + $size - ($quiet + $row + 1) * $cell;
            $out .= pdf_num($cx) . ' ' . pdf_num($cy) . ' ' . pdf_num($cell) . ' ' . pdf_num($cell) . " re f\n";
        }
    }
    return $out;
}

/**
 * The 3-page document policy_summary.php hands out (download or email):
 * page 1 is a branded "meet your advisor" profile page (website-matching
 * colors, real social links only — see PDF_SOCIAL_LINKS), page 2 is the
 * per-policy detail card (porting apps/crm/src/modules/clients/exportPolicySummaryPdf.ts's
 * layout into this file's pure-PHP drawing primitives so the same document
 * can be generated server-side for emailing, not just client-side for
 * on-demand download), page 3 is claims-assistance + calculators + real
 * MDRT certificate proof — grown from 2 pages once the policy-detail page
 * had no room left for the new timeline/countdown/nominee additions
 * without the calculators-and-claims content being cut for space.
 *
 * @param array{full_name:string} $client
 * @param array{id?:string,policy_number:?string,insurer:string,product_type:string,sum_assured:?float,premium:?float,start_date:?string,renewal_date:?string,nominee_name?:?string,nominee_relation?:?string} $policy
 * @param ?string $advisorPhone The assigned associate's own number, when known — shown instead of the generic office line so the client reaches the person who actually handles their account. Falls back to the office number when null (associate has no phone on file, or the policy has no owner).
 * @param ?string $openPassword When set, the whole document is password-protected (see pdf_assemble_document()) — used for policy_summary.php's `action=email` path, never for authenticated admin/staff downloads.
 */
function pdf_write_policy_summary(array $client, array $policy, string $advisorName, ?string $advisorPhone = null, ?string $openPassword = null): string
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
    // website's own files happen to be deployed). Both logos are transparent
    // PNGs — flattened via Imagick (confirmed on this project's Hostinger
    // account) onto the background color they'll actually sit on (navy for
    // the header, cream for inside the wood frame) so each embeds as a plain
    // JPEG; if Imagick is ever unavailable, everything silently falls back
    // to a text wordmark instead of a broken image.
    //
    // Header layout (per explicit request): the Jainik Shah wordmark
    // (jainik-wordmark.png — the same transparent "Your Insurance
    // Godfather" line-art mark used elsewhere) on the LEFT, flattened onto
    // navy; the full Aangi Associates lockup on the RIGHT inside a thin
    // wood-toned frame with corner screws — the exact "hero identity
    // frame" treatment apps/website/index.html's hero already uses
    // (.hero-identity-frame, see that file for the live reference), redrawn
    // here with this file's own vector path primitives since there's no
    // CSS to reuse in a PDF.
    $jainikLogo = pdf_load_png_as_jpeg_on_background(__DIR__ . '/../assets/branding/jainik-wordmark.png', '#0f2a4a');
    $aangiLogo = pdf_load_png_as_jpeg_on_background(__DIR__ . '/../assets/branding/aangi-logo.png', '#fdfbf2');
    $photo = pdf_load_jpeg(__DIR__ . '/../assets/branding/jainik-photo.jpg');
    $images = [];
    if ($jainikLogo) $images['ImJainikLogo'] = $jainikLogo;
    if ($aangiLogo) $images['ImAangiLogo'] = $aangiLogo;
    if ($photo) $images['ImPhoto'] = $photo;

    $wood = '0.72 0.47 0.25';
    $woodDark = '0.47 0.30 0.14';
    $cream = '0.992 0.984 0.949';
    $screwGray = '0.55 0.55 0.55';

    // ---------------- PAGE 1: profile — real website copy, logo, and photo ----------------
    $p1 = '';
    $headerH = 102;
    $headerBottom = $pageHeight - $headerH;
    $p1 .= "$navy rg 0 $headerBottom $pageWidth $headerH re f\n";

    // Left: Jainik Shah wordmark on navy.
    if ($jainikLogo) {
        $jh = 74;
        $jw = $jh * $jainikLogo['width'] / $jainikLogo['height'];
        $jy = $headerBottom + ($headerH - $jh) / 2;
        $p1 .= "q $jw 0 0 $jh $marginX $jy cm /ImJainikLogo Do Q\n";
    } else {
        $p1 .= "1 g BT /F2 18 Tf $marginX " . ($headerBottom + $headerH / 2 - 6) . " Td (" . $esc('JAINIK SHAH') . ") Tj ET\n";
    }

    // Right: thin wood frame around the full Aangi Associates lockup —
    // same visual language as the website hero's identity frame (outer
    // wood-toned border, cream interior, 4 corner screws).
    $frameW = 230;
    $frameH = 80;
    $frameX = $pageWidth - $marginX - $frameW;
    $frameY = $headerBottom + ($headerH - $frameH) / 2;
    $border = 6;
    $p1 .= "$wood rg " . pdf_rounded_rect_path($frameX, $frameY, $frameW, $frameH, 8) . "f\n";
    $p1 .= "$woodDark RG 1.2 w " . pdf_rounded_rect_path($frameX, $frameY, $frameW, $frameH, 8) . "S\n";
    $innerX = $frameX + $border;
    $innerY = $frameY + $border;
    $innerW = $frameW - $border * 2;
    $innerH = $frameH - $border * 2;
    $p1 .= "$cream rg " . pdf_rounded_rect_path($innerX, $innerY, $innerW, $innerH, 4) . "f\n";
    if ($aangiLogo) {
        $alH = $innerH - 6;
        $alW = $alH * $aangiLogo['width'] / $aangiLogo['height'];
        if ($alW > $innerW - 6) { $alW = $innerW - 6; $alH = $alW * $aangiLogo['height'] / $aangiLogo['width']; }
        $alX = $innerX + ($innerW - $alW) / 2;
        $alY = $innerY + ($innerH - $alH) / 2;
        $p1 .= "q $alW 0 0 $alH $alX $alY cm /ImAangiLogo Do Q\n";
    } else {
        $p1 .= "$navy rg BT /F2 14 Tf " . ($innerX + 14) . ' ' . ($innerY + $innerH / 2 - 5) . " Td (" . $esc('AANGI ASSOCIATES') . ") Tj ET\n";
    }
    foreach ([[0, 0], [1, 0], [0, 1], [1, 1]] as [$cxFrac, $cyFrac]) {
        $scx = $frameX + 9 + $cxFrac * ($frameW - 18);
        $scy = $frameY + 9 + $cyFrac * ($frameH - 18);
        $p1 .= "$screwGray rg " . pdf_circle_path($scx, $scy, 2.8) . "f\n";
        $p1 .= "0.3 0.3 0.3 rg " . pdf_circle_path($scx, $scy, 1) . "f\n";
    }

    $p1 .= "$gold rg 0 " . ($headerBottom - 2) . " $pageWidth 2 re f\n";

    // Tagline strip, directly under the header.
    $taglineH = 22;
    $taglineBottom = $headerBottom - 2 - $taglineH;
    $p1 .= "$surface2 rg 0 $taglineBottom $pageWidth $taglineH re f\n";
    $taglineText = 'PROTECTING WHAT MATTERS  .  SECURING WHAT YOU BUILD';
    $taglineW = strlen($taglineText) * 10 * 0.52; // same average-char-width estimate pdf_wrap_text() uses, just for centering
    $p1 .= "$gold rg BT /F2 10 Tf " . (($pageWidth - $taglineW) / 2) . ' ' . ($taglineBottom + 8) . " Td (" . $esc($taglineText) . ") Tj ET\n";

    // Hero: photo on the left in a gold-framed box, headline + CTA on the right.
    $photoW = 160;
    $photoH = $photo ? $photoW * $photo['height'] / $photo['width'] : 200;
    $photoTop = $taglineBottom - 16;
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

    // Pull-quote, verbatim from the website's About section — now a proper
    // rounded card with an eyebrow label above it, instead of a bare gold
    // bar + text, matching the eyebrow-label treatment the website itself
    // uses (.cert-eyebrow) ahead of its own sectioned content.
    $p1 .= "$gold rg BT /F1 8 Tf $marginX $y Td (" . $esc('IN HIS OWN WORDS') . ") Tj ET\n";
    $p1 .= "$gold rg $marginX " . ($y - 5) . " 130 1 re f\n";
    $y -= 20;
    $quoteLines = pdf_wrap_text('"Insurance is not just about issuing a policy. It is about protecting income, assets, business, and family security."', $pageWidth - $marginX * 2 - 34, 11);
    $quoteCardH = max(50, count($quoteLines) * 14 + 20);
    $quoteCardTop = $y;
    $quoteCardBottom = $quoteCardTop - $quoteCardH;
    $p1 .= "$surface2 rg " . pdf_rounded_rect_path($marginX, $quoteCardBottom, $pageWidth - $marginX * 2, $quoteCardH, 10) . "f\n";
    $p1 .= "$gold rg " . pdf_rounded_rect_path($marginX + 14, $quoteCardBottom + 8, 4, $quoteCardH - 16, 2) . "f\n";
    foreach ($quoteLines as $i => $line_) {
        $p1 .= "$navy rg BT /F2 11 Tf " . ($marginX + 30) . ' ' . ($quoteCardTop - 20 - $i * 14) . " Td (" . $esc($line_) . ") Tj ET\n";
    }
    $y = $quoteCardBottom - 20;

    // Bio — the two real paragraphs from the website's About section,
    // now under its own eyebrow label for the same visual rhythm as the
    // quote card above and the stats/contact sections below.
    $p1 .= "$gold rg BT /F1 8 Tf $marginX $y Td (" . $esc('ABOUT JAINIK SHAH') . ") Tj ET\n";
    $p1 .= "$gold rg $marginX " . ($y - 5) . " 130 1 re f\n";
    $y -= 20;
    $p1 .= "$navy rg BT /F2 11 Tf $marginX $y Td (" . $esc('Chief Business Associate Leader - TATA AIA Life Insurance') . ") Tj ET\n";
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

    // Trust stats — verbatim from the website's trust strip, now rounded
    // cards with a thin outline for more depth than a flat fill alone.
    $y -= 8;
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
        $p1 .= "$surface2 rg " . pdf_rounded_rect_path($sx, $y - $statH, $statW, $statH, 6) . "f\n";
        $p1 .= "$line RG 0.6 w " . pdf_rounded_rect_path($sx, $y - $statH, $statW, $statH, 6) . "S\n";
        $p1 .= "$gold rg " . ($sx + 4) . ' ' . ($y - 3) . ' ' . ($statW - 8) . " 3 re f\n";
        foreach (pdf_wrap_text($stat, $statW - 12, 8) as $li => $line_) {
            $p1 .= "$navy rg BT /F2 8 Tf " . ($sx + 6) . " " . ($y - 16 - $li * 10) . " Td (" . $esc($line_) . ") Tj ET\n";
        }
    }
    $y -= $statH + 20;

    // Reach Us + Connect With Us — one combined card: the office contact
    // details already shown before, plus a real social-links row (the
    // same 4 accounts apps/website/contact.html actually links to — never
    // invented), each icon a genuine clickable annotation to that account.
    $cardTop = $y;
    $cardH = 124;
    $cardBottom = $cardTop - $cardH;
    $pad = 14;
    $p1 .= "$surface2 rg " . pdf_rounded_rect_path($marginX, $cardBottom, $pageWidth - $marginX * 2, $cardH, 10) . "f\n";
    $p1 .= "$navy rg BT /F2 11 Tf " . ($marginX + $pad) . ' ' . ($cardTop - 16) . " Td (" . $esc('Reach Us Anytime') . ") Tj ET\n";
    $rowY = $cardTop - 34;
    $p1 .= "$text rg BT /F1 10 Tf " . ($marginX + $pad) . " $rowY Td (" . $esc("Phone / WhatsApp: $officePhone") . ") Tj ET\n";
    $annotsP1[] = ['rect' => [$marginX + $pad, $rowY - 2, $marginX + 230, $rowY + 10], 'uri' => 'https://wa.me/' . preg_replace('/\D/', '', $officePhone)];
    $p1 .= "$text rg BT /F1 10 Tf " . ($marginX + 270) . " $rowY Td (" . $esc('Website: aa.tmarinternational.com') . ") Tj ET\n";
    $annotsP1[] = ['rect' => [$marginX + 270, $rowY - 2, $marginX + 480, $rowY + 10], 'uri' => $website];
    $rowY -= 16;
    $p1 .= "$textSoft rg BT /F1 9 Tf " . ($marginX + $pad) . " $rowY Td (" . $esc($officeAddress . '  -  GSTIN: 24ACBFA747OP1Z2') . ") Tj ET\n";

    $dividerY = $rowY - 14;
    $p1 .= "$line RG 0.6 w " . ($marginX + $pad) . " $dividerY m " . ($pageWidth - $marginX - $pad) . " $dividerY l S\n";
    $p1 .= "$gold rg BT /F1 8 Tf " . ($marginX + $pad) . ' ' . ($dividerY - 12) . " Td (" . $esc('CONNECT WITH US') . ") Tj ET\n";

    $badgeR = 11;
    $badgeCy = $dividerY - 30;
    $usableW = ($pageWidth - $marginX * 2) - $pad * 2;
    // 5 segments now, not 4 — the 5th holds a scannable QR code straight
    // to the WhatsApp chat (see pdf_draw_qr()), for anyone holding a
    // printed/screenshotted copy rather than tapping the link directly.
    $segW = $usableW / 5;
    $socials = [
        ['kind' => 'instagram', 'label' => 'Instagram', 'uri' => PDF_SOCIAL_LINKS['instagram']],
        ['kind' => 'linkedin', 'label' => 'LinkedIn', 'uri' => PDF_SOCIAL_LINKS['linkedin']],
        ['kind' => 'whatsapp', 'label' => 'WhatsApp', 'uri' => PDF_SOCIAL_LINKS['whatsapp']],
        ['kind' => 'email', 'label' => 'Email', 'uri' => PDF_SOCIAL_LINKS['email']],
    ];
    foreach ($socials as $i => $s) {
        $scx = $marginX + $pad + $segW * ($i + 0.5);
        $p1 .= pdf_social_badge($scx, $badgeCy, $badgeR, $s['kind']);
        $labelW = strlen($s['label']) * 7 * 0.52;
        $p1 .= "$textSoft rg BT /F1 7 Tf " . ($scx - $labelW / 2) . ' ' . ($badgeCy - $badgeR - 10) . " Td (" . $esc($s['label']) . ") Tj ET\n";
        $annotsP1[] = ['rect' => [$scx - $segW / 2 + 4, $badgeCy - $badgeR - 14, $scx + $segW / 2 - 4, $badgeCy + $badgeR + 4], 'uri' => $s['uri']];
    }
    $qrSide = $badgeR * 2;
    $qrCx = $marginX + $pad + $segW * 4.5;
    $qrX = $qrCx - $qrSide / 2;
    $qrY = $badgeCy - $qrSide / 2;
    $p1 .= pdf_draw_qr($qrX, $qrY, $qrSide, PDF_SOCIAL_LINKS['whatsapp']);
    $qrLabel = 'Scan to Chat';
    $qrLabelW = strlen($qrLabel) * 7 * 0.52;
    $p1 .= "$textSoft rg BT /F1 7 Tf " . ($qrCx - $qrLabelW / 2) . ' ' . ($badgeCy - $badgeR - 10) . " Td (" . $esc($qrLabel) . ") Tj ET\n";
    $annotsP1[] = ['rect' => [$qrX, $qrY, $qrX + $qrSide, $qrY + $qrSide], 'uri' => PDF_SOCIAL_LINKS['whatsapp']];

    $footerY1 = 22;
    $p1 .= "$navy rg 0 0 $pageWidth $footerY1 re f\n";
    $p1 .= "$onNavy rg BT /F1 8 Tf $marginX 8 Td (" . $esc('This profile page accompanies every policy summary Aangi Associates sends or hands out.') . ") Tj ET\n";
    $genStamp = 'Generated ' . date('d M Y, H:i') . (isset($policy['id']) ? '  .  Ref: ' . strtoupper(substr((string) $policy['id'], 0, 8)) : '');
    $genStampW = strlen($genStamp) * 7 * 0.52;
    $p1 .= "$onNavy rg BT /F1 7 Tf " . ($pageWidth - $marginX - $genStampW) . " 8 Td (" . $esc($genStamp) . ") Tj ET\n";

    // ---------------- PAGE 2: policy detail (ported from exportPolicySummaryPdf.ts) ----------------
    // Starts with a faint rotated wordmark watermark (see pdf_watermark())
    // — this is the "valuable/official" page, the one most likely to be
    // screenshotted or forwarded on its own, so it gets the extra
    // tamper-visual treatment rather than page 1's busy header-heavy design.
    $p2 = pdf_watermark($pageWidth, $pageHeight);
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
    $nomineeName = trim((string) ($policy['nominee_name'] ?? ''));
    $hasNominee = $nomineeName !== '';
    $cardHeight = $hasNominee ? 140 : 112; // +28 for the extra nominee row
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
    if ($hasNominee) {
        $rowY -= 28;
        $nomineeRelation = trim((string) ($policy['nominee_relation'] ?? ''));
        $row2((string) $colL, $rowY, 'Nominee', $nomineeRelation !== '' ? "$nomineeName ($nomineeRelation)" : $nomineeName);
    }

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

    // Policy timeline + renewal countdown — purely computed from this
    // policy's own real dates (pdf_timeline_bar()/pdf_renewal_countdown_label()
    // both return nothing/null rather than guess if a date is missing).
    $countdown = pdf_renewal_countdown_label($policy['renewal_date'] ?? null);
    // The countdown badge sits on the SAME row as the "POLICY TIMELINE"
    // label, right-aligned — not beside the bar itself. An earlier
    // version placed it beside the bar at the bar's own height, which
    // put it directly on top of the bar's right-hand end-date label
    // whenever the badge text was long (e.g. "10 day(s) overdue -
    // please renew promptly") — caught visually, not by any PHP error,
    // which is exactly why every new page layout here gets rendered and
    // eyeballed before shipping, not just lint-checked.
    $timelineBar = pdf_timeline_bar($marginX, $y - 8, $pageWidth - $marginX * 2, $policy['start_date'] ?? null, $policy['renewal_date'] ?? null);
    if ($timelineBar !== '') {
        $p2 .= "$textSoft rg BT /F1 8 Tf $marginX " . ($y + 6) . " Td (" . $esc('POLICY TIMELINE') . ") Tj ET\n";
        if ($countdown) {
            $badgeColor = $countdown['tone'] === 'alert' ? $crimson : ($countdown['tone'] === 'warn' ? $gold : $navy);
            $badgeTextW = strlen($countdown['text']) * 7.5 * 0.52 + 16;
            $bx = $pageWidth - $marginX - $badgeTextW;
            $by = $y - 1;
            $p2 .= "$badgeColor rg " . pdf_rounded_rect_path($bx, $by, $badgeTextW, 16, 8) . "f\n";
            $p2 .= "1 g BT /F2 7.5 Tf " . ($bx + 8) . ' ' . ($by + 4.5) . " Td (" . $esc($countdown['text']) . ") Tj ET\n";
        }
        $p2 .= $timelineBar;
        $y -= 42;
    }

    foreach (pdf_wrap_text("This is a quick-reference summary, not a substitute for your official policy document, premium receipt, or policy wording - please refer to those for the complete terms, conditions, and exclusions.", $pageWidth - $marginX * 2, 8) as $i => $line_) {
        $p2 .= "$textSoft rg BT /F1 8 Tf $marginX " . ($y - $i * 11) . " Td (" . $esc($line_) . ") Tj ET\n";
    }

    // Footer band — the assigned associate's own phone when known
    // (falls back to the office line otherwise), so the client reaches
    // the person who actually handles their account, not a generic desk.
    $footerY2 = 28;
    $p2 .= "$navy rg 0 0 $pageWidth $footerY2 re f\n";
    $p2 .= "1 g BT /F2 9 Tf $marginX 17 Td (" . $esc('Reach Us Anytime') . ") Tj ET\n";
    $contactPhone = $advisorPhone ?: $officePhone;
    $contactLine = "$advisorName  .  $contactPhone (tap to WhatsApp)";
    $p2 .= "1 g BT /F1 8 Tf $marginX 7 Td (" . $esc($contactLine) . ") Tj ET\n";
    $waMessage = rawurlencode("Hi, I'm {$client['full_name']} - I'd like to talk about reviewing my family's protection plan.");
    $annotsP2[] = ['rect' => [$marginX, 5, $marginX + 260, 15], 'uri' => 'https://wa.me/' . preg_replace('/\D/', '', $contactPhone) . '?text=' . $waMessage];
    if (isset($policy['id'])) {
        $genStamp2 = 'Generated ' . date('d M Y, H:i') . '  .  Ref: ' . strtoupper(substr((string) $policy['id'], 0, 8));
        $p2 .= "0.6 0.6 0.6 rg BT /F1 7 Tf " . ($pageWidth - $marginX - strlen($genStamp2) * 7 * 0.52) . " 17 Td (" . $esc($genStamp2) . ") Tj ET\n";
    }

    // ---------------- PAGE 3: claims assistance, real document checklist, MDRT proof, calculators ----------------
    $p3 = pdf_watermark($pageWidth, $pageHeight);
    $annotsP3 = [];
    $p3 .= "$navy rg 0 816 $pageWidth 26 re f\n";
    $p3 .= "1 g BT /F2 10 Tf " . ($pageWidth - $marginX - 170) . " 830 Td (" . $esc($officePhone) . ") Tj ET\n";
    $p3 .= "$gold rg 0 814.5 $pageWidth 1.3 re f\n";
    $p3 .= "$text rg BT /F2 20 Tf $marginX 790 Td (" . $esc('CLAIMS ASSISTANCE & RESOURCES') . ") Tj ET\n";
    $p3 .= "$gold RG 2 w $marginX 785 m " . ($marginX + 26) . " 785 l S 0 w\n";

    // The real 4-step claims process (PDF_CLAIMS_STEPS, verbatim from the
    // website), as a 2x2 grid of compact cards.
    $y = 760;
    $p3 .= "$gold rg BT /F1 8 Tf $marginX $y Td (" . $esc('HOW YOUR CLAIM GETS HANDLED') . ") Tj ET\n";
    $y -= 20;
    $stepColW = ($pageWidth - $marginX * 2 - 10) / 2;
    $stepRowH = 56;
    foreach (PDF_CLAIMS_STEPS as $i => $step) {
        $col = $i % 2;
        $row = (int) ($i / 2);
        $sx = $marginX + $col * ($stepColW + 10);
        $syTop = $y - $row * ($stepRowH + 10);
        $p3 .= "$surface2 rg " . pdf_rounded_rect_path($sx, $syTop - $stepRowH, $stepColW, $stepRowH, 8) . "f\n";
        $p3 .= "$gold rg " . pdf_rounded_rect_path($sx, $syTop - 4, 40, 4, 2) . "f\n";
        $p3 .= "$gold rg BT /F2 8.5 Tf " . ($sx + 10) . " " . ($syTop - 16) . " Td (" . $esc($step['label']) . ") Tj ET\n";
        $p3 .= "$navy rg BT /F2 10.5 Tf " . ($sx + 10) . " " . ($syTop - 30) . " Td (" . $esc($step['title']) . ") Tj ET\n";
        foreach (pdf_wrap_text($step['body'], $stepColW - 20, 8) as $li => $line_) {
            if ($li > 2) break;
            $p3 .= "$textSoft rg BT /F1 8 Tf " . ($sx + 10) . " " . ($syTop - 44 - $li * 10) . " Td (" . $esc($line_) . ") Tj ET\n";
        }
    }
    $stepGridRows = (int) ceil(count(PDF_CLAIMS_STEPS) / 2);
    $y -= $stepGridRows * ($stepRowH + 8) + 6;
    foreach (pdf_wrap_text('Illustrative timeline based on typical cases - actual timing depends on the insurer, claim type, and documentation completeness.', $pageWidth - $marginX * 2, 7.5) as $line_) {
        $p3 .= "$textSoft rg BT /F1 7.5 Tf $marginX $y Td (" . $esc($line_) . ") Tj ET\n";
        $y -= 10;
    }
    $y -= 14;

    // Document checklist matching THIS policy's product type, if any —
    // see pdf_claim_checklist()'s docblock for why this never shows a
    // checklist for a non-insurance product (loans, credit cards).
    $checklist = pdf_claim_checklist($policy['product_type']);
    if ($checklist) {
        $p3 .= "$gold rg BT /F1 8 Tf $marginX $y Td (" . $esc('DOCUMENTS YOU\'LL LIKELY NEED') . ") Tj ET\n";
        $y -= 16;
        foreach (pdf_wrap_text($checklist['title'], $pageWidth - $marginX * 2, 10.5) as $line_) {
            $p3 .= "$navy rg BT /F2 10.5 Tf $marginX $y Td (" . $esc($line_) . ") Tj ET\n";
            $y -= 14;
        }
        $y -= 4;
        $checkColW = ($pageWidth - $marginX * 2 - 14) / 2;
        $itemsPerCol = (int) ceil(count($checklist['items']) / 2);
        foreach ($checklist['items'] as $i => $item) {
            $col = (int) ($i / $itemsPerCol);
            $rowIdx = $i % $itemsPerCol;
            $ix = $marginX + $col * ($checkColW + 14);
            $iy = $y - $rowIdx * 21;
            $p3 .= "$line RG 0.8 w " . ($ix) . ' ' . ($iy - 8) . " 7 7 re S\n"; // a small checkbox square
            foreach (pdf_wrap_text($item, $checkColW - 16, 8) as $li => $line_) {
                if ($li > 1) break;
                $p3 .= "$text rg BT /F1 8 Tf " . ($ix + 12) . ' ' . ($iy - 2 - $li * 10) . " Td (" . $esc($line_) . ") Tj ET\n";
            }
        }
        $y -= $itemsPerCol * 21 + 4;
        foreach (pdf_wrap_text('Illustrative - commonly required documents, not an official insurer list. Your claim desk contact will confirm the exact requirements for your policy.', $pageWidth - $marginX * 2, 7.5) as $line_) {
            $p3 .= "$textSoft rg BT /F1 7.5 Tf $marginX $y Td (" . $esc($line_) . ") Tj ET\n";
            $y -= 10;
        }
        $y -= 14;
    }

    // Real MDRT certificate thumbnails (2021/2022/2024/2025 — never a
    // fabricated 2023) — actual scans, resized via pdf_load_jpeg_resized().
    $mdrtYears = ['2021', '2022', '2024', '2025'];
    $mdrtImages = [];
    foreach ($mdrtYears as $yr) {
        $img = pdf_load_jpeg_resized(__DIR__ . "/../assets/branding/mdrt-cert-$yr.jpg", 240);
        if ($img) $mdrtImages["ImMdrt$yr"] = $img;
    }
    if ($mdrtImages) {
        $p3 .= "$gold rg BT /F1 8 Tf $marginX $y Td (" . $esc('REAL MDRT RECOGNITION - ON FILE') . ") Tj ET\n";
        $y -= 18;
        $thumbW = ($pageWidth - $marginX * 2 - 3 * 8) / 4;
        $thumbH = 58;
        $i = 0;
        foreach ($mdrtYears as $yr) {
            $key = "ImMdrt$yr";
            if (!isset($mdrtImages[$key])) { $i++; continue; }
            $img = $mdrtImages[$key];
            $tx = $marginX + $i * ($thumbW + 8);
            $ty = $y - $thumbH;
            $iw = $thumbW;
            $ih = $iw * $img['height'] / $img['width'];
            if ($ih > $thumbH) { $ih = $thumbH; $iw = $ih * $img['width'] / $img['height']; }
            $ix = $tx + ($thumbW - $iw) / 2;
            $iy = $ty + ($thumbH - $ih) / 2;
            $p3 .= "$line RG 0.6 w $tx $ty $thumbW $thumbH re S\n";
            $p3 .= "q $iw 0 0 $ih $ix $iy cm /$key Do Q\n";
            $yrLabelW = strlen($yr) * 8 * 0.52;
            $p3 .= "$navy rg BT /F2 8 Tf " . ($tx + ($thumbW - $yrLabelW) / 2) . ' ' . ($ty - 11) . " Td (" . $esc($yr) . ") Tj ET\n";
            $i++;
        }
        $y -= $thumbH + 40;
    }

    // Calculators showcase (moved here from page 2 to make room) — every
    // calculator actually on the website (apps/website/calculators.html),
    // not a curated subset. Each links to the same calculators page
    // rather than a fabricated per-calculator deep link: the live page has
    // no URL-hash tab routing (confirmed by reading its JS), so one clear
    // "Open All Calculators" button is more honest than 16 identical-
    // looking buttons that all quietly go to the same place.
    $p3 .= "$gold rg BT /F2 12 Tf $marginX $y Td (" . $esc('Explore More Protection for Your Family') . ") Tj ET\n";
    $y -= 16;
    foreach (pdf_wrap_text("A policy review takes 15 minutes and could reveal gaps in health, savings, or retirement cover you haven't thought about yet. Reply on WhatsApp below whenever you'd like to talk it through - no obligation.", $pageWidth - $marginX * 2, 9) as $i => $line_) {
        $p3 .= "$textSoft rg BT /F1 9 Tf $marginX " . ($y - $i * 12) . " Td (" . $esc($line_) . ") Tj ET\n";
    }
    $y -= 36;
    $p3 .= "$navy rg $marginX " . ($y - 16) . " " . ($pageWidth - $marginX * 2) . " 16 re f\n";
    $p3 .= "1 g BT /F2 11 Tf " . ($marginX + 10) . " " . ($y - 11) . " Td (" . $esc('Free Financial Calculators') . ") Tj ET\n";
    $y -= 26;
    foreach (pdf_wrap_text('Illustrative planning tools, free to use on our website - estimate what you need, not what to buy.', $pageWidth - $marginX * 2, 9) as $line_) {
        $p3 .= "$textSoft rg BT /F1 9 Tf $marginX $y Td (" . $esc($line_) . ") Tj ET\n";
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
    $calcRowH = 19;
    foreach ($calculators as $i => $calcName) {
        $col = $i % 2;
        $row = (int) ($i / 2);
        $cx = $marginX + $col * ($calcColW + 10);
        $cyTop = $y - $row * $calcRowH;
        $p3 .= "$surface2 rg $cx " . ($cyTop - 17) . " $calcColW 17 re f\n";
        $p3 .= "$gold rg $cx " . ($cyTop - 17) . " 3 17 re f\n";
        foreach (pdf_wrap_text($calcName, $calcColW - 16, 8.5) as $li => $line_) {
            if ($li > 1) break; // 2 lines max per card keeps the grid even
            $p3 .= "$navy rg BT /F2 8.5 Tf " . ($cx + 10) . " " . ($cyTop - 12 - $li * 10) . " Td (" . $esc($line_) . ") Tj ET\n";
        }
    }
    $gridRows = (int) ceil(count($calculators) / 2);
    $y -= $gridRows * $calcRowH + 16;

    $calcBtnW = 220;
    $p3 .= "$gold rg $marginX " . ($y - 24) . " $calcBtnW 24 re f\n";
    $p3 .= "1 g BT /F2 10 Tf " . ($marginX + 14) . " " . ($y - 16) . " Td (" . $esc('Open All Calculators ->') . ") Tj ET\n";
    $annotsP3[] = ['rect' => [$marginX, $y - 24, $marginX + $calcBtnW, $y], 'uri' => 'https://aa.tmarinternational.com/calculators.html'];

    $footerY3 = 22;
    $p3 .= "$navy rg 0 0 $pageWidth $footerY3 re f\n";
    $p3 .= "$onNavy rg BT /F1 8 Tf $marginX 8 Td (" . $esc('Thank you for choosing Aangi Associates. We are here whenever you need us.') . ") Tj ET\n";

    $allImages = $images;
    foreach ($mdrtImages as $k => $v) $allImages[$k] = $v;

    return pdf_assemble_document(
        [
            ['content' => $p1, 'annots' => $annotsP1],
            ['content' => $p2, 'annots' => $annotsP2],
            ['content' => $p3, 'annots' => $annotsP3],
        ],
        $allImages,
        $pageWidth,
        $pageHeight,
        $openPassword,
    );
}

// Romanized-Gujarati labels for the compact variant's ?lang=gu option.
// IMPORTANT, read before trusting this for real client use: this file's
// PDF engine has only the built-in Helvetica font (WinAnsiEncoding,
// Latin script only, enforced by pdf_write_escape_text()'s transliterate-
// or-drop pass) — it CANNOT render actual Gujarati/Devanagari glyphs at
// all, and that script's conjuncts/matras need real shaping besides,
// which a positioned-text PDF engine like this one can't do correctly
// even with a Unicode font embedded. Real Gujarati script was therefore
// not attempted. What's here is a best-effort ROMANIZED (Latin-script)
// transliteration of just the structural labels — not the prose — by an
// AI assistant, not a native speaker: treat it as a draft and have
// someone fluent in Gujarati review the wording before relying on it
// with real clients.
const PDF_LABELS_GU = [
    'Policy Summary' => 'Policy Summary',
    'For ' => '',           // Gujarati puts the subject before "mate" ("for"), handled inline where used
    'Policy Detail' => 'Policy ni Vigat',
    'Policyholder' => 'Policy Dharak',
    'Policy Start Date' => 'Shuru Tarikh',
    'Renewal / End Date' => 'Renewal / Puri Thava ni Tarikh',
    'Policy Number' => 'Policy Number',
    'Policy Type' => 'Policy no Prakar',
    'Insurance Company' => 'Vima Company',
    'Nominee' => 'Nominee',
    'Sum Assured' => 'Vima Rakam',
    'Premium' => 'Premium',
    'Talk to %s on WhatsApp ->' => '%s saathe WhatsApp par vaat karo ->',
    'This is a quick-reference summary - not a substitute for your official policy document.' => 'A ek sankshipt saar chhe - tamara official policy document nu sthan lai shakatu nathi.',
];

/** Looks up $key in PDF_LABELS_GU when $lang is 'gu', else returns $key unchanged (English, the only other supported value). Falls back to the English $key if a translation is somehow missing, rather than printing a blank. */
function pdf_label(string $key, string $lang): string
{
    if ($lang !== 'gu') return $key;
    return PDF_LABELS_GU[$key] ?? $key;
}

/**
 * A single-page "quick share" variant for WhatsApp sharing rather than
 * email/print — same real branding, data, and WhatsApp CTA + QR as
 * pdf_write_policy_summary(), with the bio/claims/calculators/MDRT
 * content that takes that one to 3 pages left out entirely.
 *
 * $lang: 'en' (default) or 'gu' for Romanized-Gujarati labels — see
 * PDF_LABELS_GU's docblock above for exactly what that does and doesn't
 * cover before using it with a real client.
 *
 * @param array{full_name:string} $client
 * @param array{id?:string,policy_number:?string,insurer:string,product_type:string,sum_assured:?float,premium:?float,start_date:?string,renewal_date:?string,nominee_name?:?string,nominee_relation?:?string} $policy
 */
function pdf_write_policy_summary_compact(array $client, array $policy, string $advisorName, ?string $advisorPhone = null, string $lang = 'en'): string
{
    $pageWidth = 595;
    $pageHeight = 842;
    $marginX = 40;
    $officePhone = '+91 90331 32791';
    $navy = PDF_BRAND['navy'];
    $gold = PDF_BRAND['gold'];
    $crimson = PDF_BRAND['crimson'];
    $text = PDF_BRAND['text'];
    $textSoft = PDF_BRAND['text_soft'];
    $surface2 = PDF_BRAND['surface2'];
    $line = PDF_BRAND['line'];
    $esc = fn (string $s) => pdf_write_escape_text($s);
    $t = fn (string $key) => pdf_label($key, $lang);
    $annots = [];

    $aangiLogo = pdf_load_png_as_jpeg_on_background(__DIR__ . '/../assets/branding/aangi-logo.png', '#0f2a4a');
    $images = [];
    if ($aangiLogo) $images['ImAangiLogo'] = $aangiLogo;

    $p = pdf_watermark($pageWidth, $pageHeight);
    $headerH = 64;
    $p .= "$navy rg 0 " . ($pageHeight - $headerH) . " $pageWidth $headerH re f\n";
    if ($aangiLogo) {
        $lh = 40;
        $lw = $lh * $aangiLogo['width'] / $aangiLogo['height'];
        $p .= "q $lw 0 0 $lh $marginX " . ($pageHeight - $headerH + ($headerH - $lh) / 2) . " cm /ImAangiLogo Do Q\n";
    } else {
        $p .= "1 g BT /F2 16 Tf $marginX " . ($pageHeight - 40) . " Td (" . $esc('AANGI ASSOCIATES') . ") Tj ET\n";
    }
    $p .= "$gold rg 0 " . ($pageHeight - $headerH - 2) . " $pageWidth 2 re f\n";

    $y = $pageHeight - $headerH - 34;
    $p .= "$text rg BT /F2 18 Tf $marginX $y Td (" . $esc($t('Policy Summary')) . ") Tj ET\n";
    $y -= 20;
    $forLabel = $lang === 'gu' ? $client['full_name'] . ' mate' : 'For ' . $client['full_name'];
    $p .= "$textSoft rg BT /F1 10 Tf $marginX $y Td (" . $esc($forLabel) . ") Tj ET\n";
    $y -= 28;

    $hasNominee = trim((string) ($policy['nominee_name'] ?? '')) !== '';
    $cardHeight = $hasNominee ? 140 : 112;
    $cardTop = $y;
    $p .= "$line RG 0.5 w $marginX " . ($cardTop - $cardHeight) . " " . ($pageWidth - $marginX * 2) . " $cardHeight re S\n";
    $p .= "$navy rg $marginX " . ($cardTop - 16) . " " . ($pageWidth - $marginX * 2) . " 16 re f\n";
    $p .= "1 g BT /F2 10.5 Tf " . ($marginX + 10) . " " . ($cardTop - 11) . " Td (" . $esc($t('Policy Detail')) . ") Tj ET\n";
    $colL = $marginX + 10;
    $colR = $marginX + (int) (($pageWidth - $marginX * 2) / 2) + 10;
    $rowY = $cardTop - 34;
    $row2 = function (float $x, float $y, string $label, string $value) use (&$p, $esc, $textSoft, $text) {
        $p .= "$textSoft rg BT /F1 8.5 Tf $x $y Td (" . $esc($label) . ") Tj ET\n";
        $p .= "$text rg BT /F2 11 Tf $x " . ($y - 14) . " Td (" . $esc($value) . ") Tj ET\n";
    };
    $row2((float) $colL, $rowY, $t('Policyholder'), $client['full_name']);
    $row2((float) $colR, $rowY, $t('Policy Start Date'), pdf_format_date($policy['start_date']));
    $rowY -= 28;
    $row2((float) $colL, $rowY, $t('Policy Number'), $policy['policy_number'] ?? '-');
    $row2((float) $colR, $rowY, $t('Renewal / End Date'), pdf_format_date($policy['renewal_date']));
    $rowY -= 28;
    $row2((float) $colL, $rowY, $t('Policy Type'), $policy['product_type']);
    $row2((float) $colR, $rowY, $t('Insurance Company'), $policy['insurer']);
    if ($hasNominee) {
        $rowY -= 28;
        $nomineeRelation = trim((string) ($policy['nominee_relation'] ?? ''));
        $nomineeName = (string) $policy['nominee_name'];
        $row2((float) $colL, $rowY, $t('Nominee'), $nomineeRelation !== '' ? "$nomineeName ($nomineeRelation)" : $nomineeName);
    }

    $y = $cardTop - $cardHeight - 20;
    $halfW = ($pageWidth - $marginX * 2 - 10) / 2;
    $stripHeight = 42;
    $p .= "$surface2 rg " . pdf_rounded_rect_path($marginX, $y - $stripHeight, $halfW, $stripHeight, 8) . "f\n";
    $p .= "$surface2 rg " . pdf_rounded_rect_path($marginX + $halfW + 10, $y - $stripHeight, $halfW, $stripHeight, 8) . "f\n";
    $p .= "$textSoft rg BT /F1 9 Tf " . ($marginX + 10) . " " . ($y - 14) . " Td (" . $esc($t('Sum Assured')) . ") Tj ET\n";
    $p .= "$textSoft rg BT /F1 9 Tf " . ($marginX + $halfW + 20) . " " . ($y - 14) . " Td (" . $esc($t('Premium')) . ") Tj ET\n";
    $p .= "$crimson rg BT /F2 15 Tf " . ($marginX + 10) . " " . ($y - 32) . " Td (" . $esc(pdf_format_inr($policy['sum_assured'])) . ") Tj ET\n";
    $p .= "$crimson rg BT /F2 15 Tf " . ($marginX + $halfW + 20) . " " . ($y - 32) . " Td (" . $esc(pdf_format_inr($policy['premium'])) . ") Tj ET\n";
    $y -= $stripHeight + 30;

    // WhatsApp CTA + QR, side by side — the whole point of the compact
    // variant is "easy to act on from a phone screen".
    $contactPhone = $advisorPhone ?: $officePhone;
    $waDigits = preg_replace('/\D/', '', $contactPhone);
    $waMessage = rawurlencode("Hi, I'm {$client['full_name']} - I'd like to talk about my {$policy['product_type']} policy.");
    $waUri = "https://wa.me/$waDigits?text=$waMessage";
    // The QR encodes the BARE number link, not the one with the
    // pre-filled message — that query string easily pushes the URL past
    // this QR engine's version-5/108-byte ceiling (see lib/qr.php),
    // which made qr_generate_matrix() correctly return null and the QR
    // silently vanish (caught by rendering this and actually looking,
    // not by any error). The clickable button still carries the full
    // pre-filled message; only the scanned fallback loses that nicety.
    $waUriBare = "https://wa.me/$waDigits";
    $btnW = $pageWidth - $marginX * 2 - 90;
    $p .= "$gold rg " . pdf_rounded_rect_path($marginX, $y - 36, $btnW, 36, 10) . "f\n";
    $ctaLabel = $lang === 'gu' ? sprintf(PDF_LABELS_GU['Talk to %s on WhatsApp ->'], $advisorName) : "Talk to $advisorName on WhatsApp ->";
    $p .= "1 g BT /F2 12 Tf " . ($marginX + 16) . " " . ($y - 22) . " Td (" . $esc($ctaLabel) . ") Tj ET\n";
    $annots[] = ['rect' => [$marginX, $y - 36, $marginX + $btnW, $y], 'uri' => $waUri];
    $qrSide = 36;
    $qrX = $marginX + $btnW + 14;
    $qrY = $y - 36;
    $p .= pdf_draw_qr($qrX, $qrY, $qrSide, $waUriBare);
    $annots[] = ['rect' => [$qrX, $qrY, $qrX + $qrSide, $qrY + $qrSide], 'uri' => $waUri];

    $footerY = 22;
    $p .= "$navy rg 0 0 $pageWidth $footerY re f\n";
    $p .= "0.965 0.953 0.918 rg BT /F1 8 Tf $marginX 8 Td (" . $esc($t('This is a quick-reference summary - not a substitute for your official policy document.')) . ") Tj ET\n";
    if (isset($policy['id'])) {
        $genStamp = 'Generated ' . date('d M Y, H:i') . '  .  Ref: ' . strtoupper(substr((string) $policy['id'], 0, 8));
        $p .= "0.6 0.6 0.6 rg BT /F1 7 Tf " . ($pageWidth - $marginX - strlen($genStamp) * 7 * 0.52) . " 8 Td (" . $esc($genStamp) . ") Tj ET\n";
    }

    return pdf_assemble_document([['content' => $p, 'annots' => $annots]], $images, $pageWidth, $pageHeight);
}

/**
 * A single-page household digest listing every policy a client holds —
 * for the "Download All" bulk-export flow (see bulk_policy_export.php)
 * when someone wants one document summarizing the whole relationship
 * rather than N separate per-policy PDFs. Truncates past
 * PDF_HOUSEHOLD_MAX_ROWS with a visible note, same honest-limit pattern
 * pdf_write_intimation_digest() already uses, rather than attempting
 * multi-page flow for an edge case.
 *
 * @param array{full_name:string} $client
 * @param list<array{policy_number:?string,insurer:string,product_type:string,sum_assured:?float,premium:?float,renewal_date:?string}> $policies
 */
function pdf_write_household_digest(array $client, array $policies, string $advisorName): string
{
    $pageWidth = 595;
    $pageHeight = 842;
    $marginX = 40;
    $officePhone = '+91 90331 32791';
    $navy = PDF_BRAND['navy'];
    $gold = PDF_BRAND['gold'];
    $crimson = PDF_BRAND['crimson'];
    $text = PDF_BRAND['text'];
    $textSoft = PDF_BRAND['text_soft'];
    $surface2 = PDF_BRAND['surface2'];
    $esc = fn (string $s) => pdf_write_escape_text($s);
    $annots = [];

    $aangiLogo = pdf_load_png_as_jpeg_on_background(__DIR__ . '/../assets/branding/aangi-logo.png', '#0f2a4a');
    $images = [];
    if ($aangiLogo) $images['ImAangiLogo'] = $aangiLogo;

    $p = pdf_watermark($pageWidth, $pageHeight);
    $headerH = 64;
    $p .= "$navy rg 0 " . ($pageHeight - $headerH) . " $pageWidth $headerH re f\n";
    if ($aangiLogo) {
        $lh = 40;
        $lw = $lh * $aangiLogo['width'] / $aangiLogo['height'];
        $p .= "q $lw 0 0 $lh $marginX " . ($pageHeight - $headerH + ($headerH - $lh) / 2) . " cm /ImAangiLogo Do Q\n";
    } else {
        $p .= "1 g BT /F2 16 Tf $marginX " . ($pageHeight - 40) . " Td (" . $esc('AANGI ASSOCIATES') . ") Tj ET\n";
    }
    $p .= "$gold rg 0 " . ($pageHeight - $headerH - 2) . " $pageWidth 2 re f\n";

    $y = $pageHeight - $headerH - 34;
    $p .= "$text rg BT /F2 18 Tf $marginX $y Td (" . $esc('Household Policy Digest') . ") Tj ET\n";
    $y -= 20;
    $p .= "$textSoft rg BT /F1 10 Tf $marginX $y Td (" . $esc('For ' . $client['full_name'] . '  .  Advisor: ' . $advisorName) . ") Tj ET\n";
    $y -= 30;

    $maxRows = 14;
    $truncated = count($policies) > $maxRows;
    $shown = array_slice($policies, 0, $maxRows);
    $totalSumAssured = array_sum(array_column($policies, 'sum_assured'));
    $totalPremium = array_sum(array_column($policies, 'premium'));

    // Summary strip
    $halfW = ($pageWidth - $marginX * 2 - 10) / 2;
    $p .= "$surface2 rg " . pdf_rounded_rect_path($marginX, $y - 40, $halfW, 40, 8) . "f\n";
    $p .= "$surface2 rg " . pdf_rounded_rect_path($marginX + $halfW + 10, $y - 40, $halfW, 40, 8) . "f\n";
    $p .= "$textSoft rg BT /F1 8.5 Tf " . ($marginX + 10) . " " . ($y - 14) . " Td (" . $esc(count($policies) . ' polic' . (count($policies) === 1 ? 'y' : 'ies') . ' on file - total Sum Assured') . ") Tj ET\n";
    $p .= "$crimson rg BT /F2 13 Tf " . ($marginX + 10) . " " . ($y - 30) . " Td (" . $esc(pdf_format_inr($totalSumAssured)) . ") Tj ET\n";
    $p .= "$textSoft rg BT /F1 8.5 Tf " . ($marginX + $halfW + 20) . " " . ($y - 14) . " Td (" . $esc('Combined annual premium') . ") Tj ET\n";
    $p .= "$crimson rg BT /F2 13 Tf " . ($marginX + $halfW + 20) . " " . ($y - 30) . " Td (" . $esc(pdf_format_inr($totalPremium)) . ") Tj ET\n";
    $y -= 56;

    // Table
    $rowH = 24;
    $colX = [$marginX, $marginX + 150, $marginX + 265, $marginX + 365, $marginX + 440];
    $headers = ['Product', 'Policy No.', 'Sum Assured', 'Premium', 'Renewal'];
    $p .= "$navy rg $marginX " . ($y - 16) . " " . ($pageWidth - $marginX * 2) . " 16 re f\n";
    foreach ($headers as $i => $h) {
        $p .= "1 g BT /F2 8 Tf " . ($colX[$i] + 6) . " " . ($y - 11) . " Td (" . $esc($h) . ") Tj ET\n";
    }
    $y -= 16;
    foreach ($shown as $i => $pol) {
        $rowTop = $y - $i * $rowH;
        if ($i % 2 === 1) $p .= "$surface2 rg $marginX " . ($rowTop - $rowH) . " " . ($pageWidth - $marginX * 2) . " $rowH re f\n";
        foreach (pdf_wrap_text($pol['product_type'], 144, 8.5) as $li => $line_) {
            if ($li > 0) break;
            $p .= "$text rg BT /F2 8.5 Tf " . ($colX[0] + 6) . " " . ($rowTop - 15) . " Td (" . $esc($line_) . ") Tj ET\n";
        }
        $p .= "$textSoft rg BT /F1 8 Tf " . ($colX[1] + 6) . " " . ($rowTop - 15) . " Td (" . $esc($pol['policy_number'] ?? '-') . ") Tj ET\n";
        $p .= "$textSoft rg BT /F1 8 Tf " . ($colX[2] + 6) . " " . ($rowTop - 15) . " Td (" . $esc(pdf_format_inr($pol['sum_assured'])) . ") Tj ET\n";
        $p .= "$textSoft rg BT /F1 8 Tf " . ($colX[3] + 6) . " " . ($rowTop - 15) . " Td (" . $esc(pdf_format_inr($pol['premium'])) . ") Tj ET\n";
        $p .= "$textSoft rg BT /F1 8 Tf " . ($colX[4] + 6) . " " . ($rowTop - 15) . " Td (" . $esc(pdf_format_date($pol['renewal_date'])) . ") Tj ET\n";
    }
    $y -= count($shown) * $rowH + 10;
    if ($truncated) {
        $p .= "$textSoft rg BT /F1 8 Tf $marginX $y Td (" . $esc('+ ' . (count($policies) - $maxRows) . ' more polic' . ((count($policies) - $maxRows) === 1 ? 'y' : 'ies') . ' not shown - see My Clients in the CRM for the complete list.') . ") Tj ET\n";
        $y -= 16;
    }

    $footerY = 22;
    $p .= "$navy rg 0 0 $pageWidth $footerY re f\n";
    $p .= "0.965 0.953 0.918 rg BT /F1 8 Tf $marginX 8 Td (" . $esc('This digest accompanies the individual policy summaries Aangi Associates sends or hands out.') . ") Tj ET\n";
    $waMessage = rawurlencode("Hi, I'm {$client['full_name']} - I'd like to talk about my policies.");
    $annots[] = ['rect' => [$marginX, 0, $pageWidth, $footerY], 'uri' => 'https://wa.me/' . preg_replace('/\D/', '', $officePhone) . '?text=' . $waMessage];

    return pdf_assemble_document([['content' => $p, 'annots' => $annots]], $images, $pageWidth, $pageHeight);
}
