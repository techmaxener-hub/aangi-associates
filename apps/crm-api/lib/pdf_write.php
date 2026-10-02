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
